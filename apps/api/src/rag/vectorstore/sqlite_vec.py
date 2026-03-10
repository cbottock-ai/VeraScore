"""
sqlite-vec vector store implementation.

Uses sqlite-vec extension for efficient vector similarity search
within the same SQLite database as other app data.
"""

import json
import sqlite3
from typing import Any

from src.core.config import settings
from src.rag.vectorstore.base import SearchResult, VectorStore


class SqliteVecStore(VectorStore):
    """sqlite-vec based vector store."""

    def __init__(self, db_path: str, table_name: str = "transcript_embeddings"):
        self.db_path = db_path
        self.table_name = table_name
        self._dimension = settings.embedding_dimension
        self._initialized = False

    def _get_connection(self) -> sqlite3.Connection:
        """Get a connection with sqlite-vec loaded."""
        conn = sqlite3.connect(self.db_path)
        conn.enable_load_extension(True)
        import sqlite_vec
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        return conn

    def _ensure_table(self, conn: sqlite3.Connection) -> None:
        """Create the virtual table if it doesn't exist."""
        if self._initialized:
            return

        # Create virtual table for vector storage
        conn.execute(f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS {self.table_name} USING vec0(
                chunk_id INTEGER PRIMARY KEY,
                embedding FLOAT[{self._dimension}]
            )
        """)

        # Create metadata table for additional info
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {self.table_name}_meta (
                chunk_id INTEGER PRIMARY KEY,
                transcript_id INTEGER,
                ticker TEXT,
                speaker TEXT,
                section TEXT,
                content TEXT
            )
        """)

        conn.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{self.table_name}_meta_transcript
            ON {self.table_name}_meta(transcript_id)
        """)

        conn.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{self.table_name}_meta_ticker
            ON {self.table_name}_meta(ticker)
        """)

        conn.commit()
        self._initialized = True

    async def add_embedding(
        self,
        chunk_id: int,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store an embedding with its chunk ID and metadata."""
        conn = self._get_connection()
        try:
            self._ensure_table(conn)

            # Insert into vector table
            conn.execute(
                f"INSERT OR REPLACE INTO {self.table_name}(chunk_id, embedding) VALUES (?, ?)",
                (chunk_id, json.dumps(embedding)),
            )

            # Insert metadata
            if metadata:
                conn.execute(
                    f"""INSERT OR REPLACE INTO {self.table_name}_meta
                        (chunk_id, transcript_id, ticker, speaker, section, content)
                        VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        chunk_id,
                        metadata.get("transcript_id"),
                        metadata.get("ticker"),
                        metadata.get("speaker"),
                        metadata.get("section"),
                        metadata.get("content"),
                    ),
                )

            conn.commit()
        finally:
            conn.close()

    async def add_embeddings_batch(
        self,
        items: list[tuple[int, list[float], dict[str, Any] | None]],
    ) -> None:
        """Store multiple embeddings efficiently."""
        if not items:
            return

        conn = self._get_connection()
        try:
            self._ensure_table(conn)

            for chunk_id, embedding, metadata in items:
                conn.execute(
                    f"INSERT OR REPLACE INTO {self.table_name}(chunk_id, embedding) VALUES (?, ?)",
                    (chunk_id, json.dumps(embedding)),
                )

                if metadata:
                    conn.execute(
                        f"""INSERT OR REPLACE INTO {self.table_name}_meta
                            (chunk_id, transcript_id, ticker, speaker, section, content)
                            VALUES (?, ?, ?, ?, ?, ?)""",
                        (
                            chunk_id,
                            metadata.get("transcript_id"),
                            metadata.get("ticker"),
                            metadata.get("speaker"),
                            metadata.get("section"),
                            metadata.get("content"),
                        ),
                    )

            conn.commit()
        finally:
            conn.close()

    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """Search for similar embeddings."""
        conn = self._get_connection()
        try:
            self._ensure_table(conn)

            # sqlite-vec KNN query syntax requires k = ? in WHERE clause
            # First do the vector search, then filter by metadata
            vec_query = f"""
                SELECT chunk_id, distance
                FROM {self.table_name}
                WHERE embedding MATCH ? AND k = ?
            """

            cursor = conn.execute(vec_query, [json.dumps(query_embedding), top_k * 3])
            vec_results = cursor.fetchall()

            if not vec_results:
                return []

            # Get metadata for matched chunks
            chunk_ids = [r[0] for r in vec_results]
            distances = {r[0]: r[1] for r in vec_results}

            placeholders = ",".join("?" * len(chunk_ids))
            meta_query = f"""
                SELECT chunk_id, content, transcript_id, ticker, speaker, section
                FROM {self.table_name}_meta
                WHERE chunk_id IN ({placeholders})
            """

            cursor = conn.execute(meta_query, chunk_ids)
            meta_results = {r[0]: r[1:] for r in cursor.fetchall()}

            # Combine and filter results
            results = []
            for chunk_id in chunk_ids:
                if chunk_id not in meta_results:
                    continue

                content, transcript_id, ticker, speaker, section = meta_results[chunk_id]

                # Apply metadata filters
                if filter_metadata:
                    if "ticker" in filter_metadata and ticker != filter_metadata["ticker"]:
                        continue
                    if "section" in filter_metadata and section != filter_metadata["section"]:
                        continue

                distance = distances[chunk_id]
                results.append(
                    SearchResult(
                        chunk_id=chunk_id,
                        content=content or "",
                        score=1.0 - distance,  # Convert distance to similarity
                        metadata={
                            "transcript_id": transcript_id,
                            "ticker": ticker,
                            "speaker": speaker,
                            "section": section,
                        },
                    )
                )

                if len(results) >= top_k:
                    break

            return results
        finally:
            conn.close()

    async def delete_by_transcript_id(self, transcript_id: int) -> int:
        """Delete all embeddings for a transcript."""
        conn = self._get_connection()
        try:
            self._ensure_table(conn)

            # Get chunk IDs for this transcript
            cursor = conn.execute(
                f"SELECT chunk_id FROM {self.table_name}_meta WHERE transcript_id = ?",
                (transcript_id,),
            )
            chunk_ids = [row[0] for row in cursor.fetchall()]

            if not chunk_ids:
                return 0

            # Delete from both tables
            placeholders = ",".join("?" * len(chunk_ids))
            conn.execute(
                f"DELETE FROM {self.table_name} WHERE chunk_id IN ({placeholders})",
                chunk_ids,
            )
            conn.execute(
                f"DELETE FROM {self.table_name}_meta WHERE chunk_id IN ({placeholders})",
                chunk_ids,
            )

            conn.commit()
            return len(chunk_ids)
        finally:
            conn.close()
