import logging

from sqlalchemy.orm import Session

from src.earnings.models import Transcript, TranscriptChunk
from src.earnings.service import get_transcript
from src.rag.chunking import parse_transcript_sections
from src.rag.embeddings.openai import OpenAIEmbeddingProvider
from src.rag.vectorstore.sqlite_vec import SqliteVecStore

logger = logging.getLogger(__name__)


async def ingest_transcript(
    ticker: str,
    year: int,
    quarter: int,
    db: Session,
) -> Transcript | None:
    """Fetch transcript, chunk it, embed chunks, and store in vector DB."""
    ticker = ticker.upper()

    # Get or fetch transcript
    transcript = await get_transcript(ticker, year, quarter, db)
    if not transcript or not transcript.full_text:
        logger.warning(f"No transcript found for {ticker} Q{quarter} {year}")
        return None

    # Check if already chunked
    if transcript.chunks:
        logger.info(f"Transcript {ticker} Q{quarter} {year} already chunked")
        return transcript

    # Parse and chunk
    chunks = parse_transcript_sections(transcript.full_text)
    if not chunks:
        logger.warning(f"No chunks extracted from transcript {ticker} Q{quarter} {year}")
        return transcript

    logger.info(f"Extracted {len(chunks)} chunks from {ticker} Q{quarter} {year}")

    # Save chunks to DB
    chunk_models = []
    for chunk in chunks:
        chunk_model = TranscriptChunk(
            transcript_id=transcript.id,
            chunk_index=chunk.index,
            content=chunk.content,
            speaker=chunk.speaker,
            section=chunk.section,
        )
        db.add(chunk_model)
        chunk_models.append(chunk_model)

    db.commit()

    # Refresh to get IDs
    for cm in chunk_models:
        db.refresh(cm)

    # Generate embeddings
    embedding_provider = OpenAIEmbeddingProvider()
    texts = [c.content for c in chunk_models]

    try:
        embeddings = await embedding_provider.embed_batch(texts)
    except Exception as e:
        logger.error(f"Failed to embed chunks: {e}")
        return transcript

    # Store in vector DB
    vector_store = SqliteVecStore(db, embedding_provider.dimension)

    items = []
    for chunk_model, embedding in zip(chunk_models, embeddings):
        metadata = {
            "transcript_id": transcript.id,
            "ticker": ticker,
            "fiscal_quarter": quarter,
            "fiscal_year": year,
        }
        items.append((chunk_model.id, embedding, metadata))

    await vector_store.add_embeddings_batch(items)

    logger.info(
        f"Ingested {len(chunk_models)} chunks for {ticker} Q{quarter} {year}"
    )

    return transcript


async def delete_transcript(transcript_id: int, db: Session) -> bool:
    """Delete a transcript and its embeddings."""
    transcript = db.query(Transcript).filter(Transcript.id == transcript_id).first()
    if not transcript:
        return False

    # Delete embeddings first
    vector_store = SqliteVecStore(db)
    await vector_store.delete_by_transcript_id(transcript_id)

    # Delete transcript (cascades to chunks)
    db.delete(transcript)
    db.commit()

    return True
