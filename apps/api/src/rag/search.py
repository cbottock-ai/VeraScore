import logging

from sqlalchemy.orm import Session

from src.earnings.models import TranscriptChunk
from src.earnings.schemas import TranscriptSearchResponse, TranscriptSearchResult
from src.rag.embeddings.openai import OpenAIEmbeddingProvider
from src.rag.vectorstore.sqlite_vec import SqliteVecStore

logger = logging.getLogger(__name__)


async def search_transcripts(
    query: str,
    db: Session,
    ticker: str | None = None,
    top_k: int = 5,
) -> TranscriptSearchResponse:
    """Search transcripts using semantic similarity."""
    # Embed the query
    embedding_provider = OpenAIEmbeddingProvider()
    query_embedding = await embedding_provider.embed_text(query)

    # Search vector store
    vector_store = SqliteVecStore(db, embedding_provider.dimension)
    filter_metadata = {"ticker": ticker} if ticker else None

    results = await vector_store.search(
        query_embedding=query_embedding,
        top_k=top_k,
        filter_metadata=filter_metadata,
    )

    # Fetch chunk content
    search_results = []
    for result in results:
        chunk = db.query(TranscriptChunk).filter(
            TranscriptChunk.id == result.chunk_id
        ).first()

        if chunk:
            search_results.append(
                TranscriptSearchResult(
                    ticker=result.metadata.get("ticker", ""),
                    fiscal_quarter=result.metadata.get("fiscal_quarter", 0),
                    fiscal_year=result.metadata.get("fiscal_year", 0),
                    chunk_content=chunk.content,
                    speaker=chunk.speaker,
                    section=chunk.section,
                    relevance_score=result.score,
                )
            )

    return TranscriptSearchResponse(query=query, results=search_results)


async def get_transcript_summary(
    ticker: str,
    year: int,
    quarter: int,
    db: Session,
) -> dict:
    """Get a summary of a transcript with key topics."""
    from src.earnings.models import Transcript

    ticker = ticker.upper()

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
        return {
            "ticker": ticker,
            "fiscal_quarter": quarter,
            "fiscal_year": year,
            "error": "Transcript not found",
        }

    # Get chunks for topic extraction
    chunks = (
        db.query(TranscriptChunk)
        .filter(TranscriptChunk.transcript_id == transcript.id)
        .order_by(TranscriptChunk.chunk_index)
        .all()
    )

    # Extract speakers mentioned
    speakers = set()
    for chunk in chunks:
        if chunk.speaker:
            speakers.add(chunk.speaker)

    # Count sections
    prepared_count = sum(1 for c in chunks if c.section == "prepared_remarks")
    qa_count = sum(1 for c in chunks if c.section == "q_and_a")

    # Generate a basic summary from first few chunks
    summary_chunks = chunks[:3] if chunks else []
    summary_text = " ".join(c.content[:200] for c in summary_chunks)
    if len(summary_text) > 500:
        summary_text = summary_text[:500] + "..."

    # Extract key topics (simple keyword extraction)
    key_topics = _extract_key_topics(transcript.full_text or "")

    return {
        "ticker": ticker,
        "fiscal_quarter": quarter,
        "fiscal_year": year,
        "call_date": transcript.call_date,
        "summary": summary_text,
        "key_topics": key_topics,
        "speakers": list(speakers),
        "prepared_remarks_chunks": prepared_count,
        "qa_chunks": qa_count,
        "total_chunks": len(chunks),
    }


def _extract_key_topics(text: str) -> list[str]:
    """Extract key topics from transcript text (simple keyword extraction)."""
    # Common financial/business topics to look for
    topic_keywords = {
        "revenue growth": ["revenue growth", "top line growth", "sales growth"],
        "margins": ["gross margin", "operating margin", "profit margin", "margin expansion"],
        "guidance": ["guidance", "outlook", "forecast", "expect"],
        "AI": ["artificial intelligence", " ai ", "machine learning", "generative ai"],
        "cloud": ["cloud", "aws", "azure", "gcp"],
        "cost reduction": ["cost cutting", "cost reduction", "efficiency", "restructuring"],
        "acquisitions": ["acquisition", "merger", "m&a", "acquired"],
        "new products": ["new product", "product launch", "innovation"],
        "supply chain": ["supply chain", "inventory", "logistics"],
        "macroeconomic": ["macro", "recession", "inflation", "interest rate"],
    }

    text_lower = text.lower()
    found_topics = []

    for topic, keywords in topic_keywords.items():
        for keyword in keywords:
            if keyword in text_lower:
                found_topics.append(topic)
                break

    return found_topics[:5]  # Limit to top 5
