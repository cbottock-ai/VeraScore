import logging
import struct

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.rag.vectorstore.base import SearchResult, VectorStore

logger = logging.getLogger(__name__)


def serialize_embedding(embedding: list[float]) -> bytes:
    """Serialize embedding to binary format for sqlite-vec."""
    return struct.pack(f"{len(embedding)}f", *embedding)


class SqliteVecStore(VectorStore):
    """Vector store using sqlite-vec extension."""

    def __init__(self, db: Session, dimension: int = 1536):
        self.db = db
        self.dimension = dimension
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        """Ensure the virtual table and metadata table exist."""
        # Metadata table for chunk info
        self.db.execute(
            text("""
                CREATE TABLE IF NOT EXISTS transcript_embedding_meta (
                    chunk_id INTEGER PRIMARY KEY,
                    transcript_id INTEGER,
                    ticker TEXT,
                    fiscal_quarter INTEGER,
                    fiscal_year INTEGER
                )
            """)
        )

        # Create virtual table for vector search
        self.db.execute(
            text(f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS transcript_embeddings
                USING vec0(
                    chunk_id INTEGER PRIMARY KEY,
                    embedding FLOAT[{self.dimension}]
                )
            """)
        )
        self.db.commit()

    async def add_embedding(
        self, chunk_id: int, embedding: list[float], metadata: dict | None = None
    ) -> None:
        """Add a single embedding to the store."""
        embedding_bytes = serialize_embedding(embedding)

        # Insert into virtual table
        self.db.execute(
            text("""
                INSERT OR REPLACE INTO transcript_embeddings (chunk_id, embedding)
                VALUES (:chunk_id, :embedding)
            """),
            {"chunk_id": chunk_id, "embedding": embedding_bytes},
        )

        # Insert metadata
        if metadata:
            self.db.execute(
                text("""
                    INSERT OR REPLACE INTO transcript_embedding_meta
                    (chunk_id, transcript_id, ticker, fiscal_quarter, fiscal_year)
                    VALUES (:chunk_id, :transcript_id, :ticker, :fiscal_quarter, :fiscal_year)
                """),
                {
                    "chunk_id": chunk_id,
                    "transcript_id": metadata.get("transcript_id"),
                    "ticker": metadata.get("ticker"),
                    "fiscal_quarter": metadata.get("fiscal_quarter"),
                    "fiscal_year": metadata.get("fiscal_year"),
                },
            )

        self.db.commit()

    async def add_embeddings_batch(
        self, items: list[tuple[int, list[float], dict | None]]
    ) -> None:
        """Add multiple embeddings in a batch."""
        for chunk_id, embedding, metadata in items:
            embedding_bytes = serialize_embedding(embedding)

            self.db.execute(
                text("""
                    INSERT OR REPLACE INTO transcript_embeddings (chunk_id, embedding)
                    VALUES (:chunk_id, :embedding)
                """),
                {"chunk_id": chunk_id, "embedding": embedding_bytes},
            )

            if metadata:
                self.db.execute(
                    text("""
                        INSERT OR REPLACE INTO transcript_embedding_meta
                        (chunk_id, transcript_id, ticker, fiscal_quarter, fiscal_year)
                        VALUES (:chunk_id, :transcript_id, :ticker, :fiscal_quarter, :fiscal_year)
                    """),
                    {
                        "chunk_id": chunk_id,
                        "transcript_id": metadata.get("transcript_id"),
                        "ticker": metadata.get("ticker"),
                        "fiscal_quarter": metadata.get("fiscal_quarter"),
                        "fiscal_year": metadata.get("fiscal_year"),
                    },
                )

        self.db.commit()

    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filter_metadata: dict | None = None,
    ) -> list[SearchResult]:
        """Search for similar embeddings."""
        query_bytes = serialize_embedding(query_embedding)

        # Build query with optional metadata filter
        select_cols = "e.chunk_id, e.distance, m.transcript_id, m.ticker"
        select_cols += ", m.fiscal_quarter, m.fiscal_year"

        if filter_metadata and filter_metadata.get("ticker"):
            result = self.db.execute(
                text(f"""
                    SELECT {select_cols}
                    FROM transcript_embeddings e
                    JOIN transcript_embedding_meta m ON e.chunk_id = m.chunk_id
                    WHERE e.embedding MATCH :query
                      AND m.ticker = :ticker
                      AND k = :top_k
                    ORDER BY e.distance
                """),
                {
                    "query": query_bytes,
                    "ticker": filter_metadata["ticker"].upper(),
                    "top_k": top_k,
                },
            )
        else:
            result = self.db.execute(
                text(f"""
                    SELECT {select_cols}
                    FROM transcript_embeddings e
                    JOIN transcript_embedding_meta m ON e.chunk_id = m.chunk_id
                    WHERE e.embedding MATCH :query
                      AND k = :top_k
                    ORDER BY e.distance
                """),
                {"query": query_bytes, "top_k": top_k},
            )

        results = []
        for row in result:
            # Distance is L2, convert to similarity score (lower distance = higher similarity)
            # Using 1 / (1 + distance) to normalize
            similarity = 1.0 / (1.0 + row.distance)
            results.append(
                SearchResult(
                    chunk_id=row.chunk_id,
                    score=similarity,
                    metadata={
                        "transcript_id": row.transcript_id,
                        "ticker": row.ticker,
                        "fiscal_quarter": row.fiscal_quarter,
                        "fiscal_year": row.fiscal_year,
                    },
                )
            )

        return results

    async def delete_by_transcript_id(self, transcript_id: int) -> int:
        """Delete all embeddings for a transcript."""
        # Get chunk IDs for this transcript
        result = self.db.execute(
            text("SELECT chunk_id FROM transcript_embedding_meta WHERE transcript_id = :tid"),
            {"tid": transcript_id},
        )
        chunk_ids = [row.chunk_id for row in result]

        if not chunk_ids:
            return 0

        # Delete from both tables
        for chunk_id in chunk_ids:
            self.db.execute(
                text("DELETE FROM transcript_embeddings WHERE chunk_id = :cid"),
                {"cid": chunk_id},
            )
            self.db.execute(
                text("DELETE FROM transcript_embedding_meta WHERE chunk_id = :cid"),
                {"cid": chunk_id},
            )

        self.db.commit()
        return len(chunk_ids)
