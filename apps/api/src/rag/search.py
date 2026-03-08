"""
RAG search service.

Handles semantic search over embedded content.
"""

from sqlalchemy.orm import Session

from src.earnings.models import TranscriptChunk
from src.rag.embeddings.base import EmbeddingProvider
from src.rag.embeddings.openai import OpenAIEmbeddingProvider
from src.rag.vectorstore.base import SearchResult, VectorStore
from src.rag.vectorstore.sqlite_vec import SqliteVecStore

# Default instances (can be swapped for testing or different providers)
_embedding_provider: EmbeddingProvider | None = None
_vector_store: VectorStore | None = None


def get_embedding_provider() -> EmbeddingProvider:
    """Get the configured embedding provider."""
    global _embedding_provider
    if _embedding_provider is None:
        _embedding_provider = OpenAIEmbeddingProvider()
    return _embedding_provider


def get_vector_store(db_path: str = "verascore.db") -> VectorStore:
    """Get the configured vector store."""
    global _vector_store
    if _vector_store is None:
        _vector_store = SqliteVecStore(db_path)
    return _vector_store


async def embed_transcript_chunks(
    db: Session,
    transcript_id: int,
    db_path: str = "verascore.db",
) -> int:
    """
    Embed all chunks for a transcript and store in vector store.

    Returns number of chunks embedded.
    """
    # Get chunks
    chunks = (
        db.query(TranscriptChunk)
        .filter(TranscriptChunk.transcript_id == transcript_id)
        .order_by(TranscriptChunk.chunk_index)
        .all()
    )

    if not chunks:
        return 0

    # Get transcript metadata
    transcript = chunks[0].transcript
    ticker = transcript.ticker

    # Embed all chunks
    provider = get_embedding_provider()
    texts = [c.content for c in chunks]
    embeddings = await provider.embed_batch(texts)

    # Store in vector store
    store = get_vector_store(db_path)
    items = [
        (
            chunk.id,
            embedding,
            {
                "transcript_id": transcript_id,
                "ticker": ticker,
                "speaker": chunk.speaker,
                "section": chunk.section,
                "content": chunk.content,
            },
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]

    await store.add_embeddings_batch(items)

    return len(chunks)


async def search_transcripts(
    query: str,
    ticker: str | None = None,
    section: str | None = None,
    top_k: int = 5,
    db_path: str = "verascore.db",
) -> list[SearchResult]:
    """
    Semantic search over transcript chunks.

    Args:
        query: Natural language search query
        ticker: Optional filter to specific stock
        section: Optional filter to "prepared_remarks" or "q_and_a"
        top_k: Number of results to return

    Returns:
        List of SearchResult with matching chunks
    """
    # Embed query
    provider = get_embedding_provider()
    query_embedding = await provider.embed_text(query)

    # Build filters
    filters = {}
    if ticker:
        filters["ticker"] = ticker.upper()
    if section:
        filters["section"] = section

    # Search
    store = get_vector_store(db_path)
    results = await store.search(
        query_embedding=query_embedding,
        top_k=top_k,
        filter_metadata=filters if filters else None,
    )

    return results


async def delete_transcript_embeddings(
    transcript_id: int,
    db_path: str = "verascore.db",
) -> int:
    """Delete all embeddings for a transcript."""
    store = get_vector_store(db_path)
    return await store.delete_by_transcript_id(transcript_id)


# --- Functions for chat tools ---

from src.earnings.schemas import TranscriptChunkResult, TranscriptSearchResponse


async def search_transcripts_for_tool(
    query: str,
    db: Session,
    ticker: str | None = None,
    top_k: int = 5,
) -> TranscriptSearchResponse:
    """Search transcripts formatted for chat tool response."""
    results = await search_transcripts(
        query=query,
        ticker=ticker,
        top_k=top_k,
    )

    chunks = [
        TranscriptChunkResult(
            content=r.content,
            score=r.score,
            ticker=r.metadata.get("ticker"),
            speaker=r.metadata.get("speaker"),
            section=r.metadata.get("section"),
        )
        for r in results
    ]

    return TranscriptSearchResponse(query=query, results=chunks)


# Alias for tools.py - overwrite the original function
_original_search = search_transcripts


async def search_transcripts(
    query: str,
    db: Session | None = None,
    ticker: str | None = None,
    top_k: int = 5,
    section: str | None = None,
    db_path: str = "verascore.db",
) -> TranscriptSearchResponse:
    """Search transcripts - handles both tool calls and direct calls."""
    if db is not None:
        # Called from tools.py
        return await search_transcripts_for_tool(query, db, ticker, top_k)
    else:
        # Direct call - return raw results
        results = await _original_search(query, ticker, section, top_k, db_path)
        chunks = [
            TranscriptChunkResult(
                content=r.content,
                score=r.score,
                ticker=r.metadata.get("ticker"),
                speaker=r.metadata.get("speaker"),
                section=r.metadata.get("section"),
            )
            for r in results
        ]
        return TranscriptSearchResponse(query=query, results=chunks)


async def get_transcript_summary(
    ticker: str,
    year: int,
    quarter: int,
    db: Session,
) -> dict:
    """
    Generate a summary of an earnings transcript.

    Uses the transcript chunks to create a summary with key points.
    """
    from src.earnings.models import Transcript

    ticker = ticker.upper()

    # Get transcript
    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.ticker == ticker,
            Transcript.fiscal_year == year,
            Transcript.fiscal_quarter == quarter,
        )
        .first()
    )

    if not transcript:
        return {"error": f"No transcript found for {ticker} Q{quarter} {year}"}

    # Get first few chunks for summary context
    chunks = transcript.chunks[:10] if transcript.chunks else []

    # Extract key speakers
    speakers = set(c.speaker for c in chunks if c.speaker)

    # Create a simple summary from the first chunks
    summary_text = " ".join(c.content[:200] for c in chunks[:3])
    if len(summary_text) > 500:
        summary_text = summary_text[:500] + "..."

    return {
        "ticker": ticker,
        "fiscal_year": year,
        "fiscal_quarter": quarter,
        "call_date": transcript.call_date.isoformat(),
        "summary": summary_text,
        "speakers": list(speakers),
        "total_chunks": len(transcript.chunks),
    }
