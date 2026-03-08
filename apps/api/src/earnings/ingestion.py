"""
Transcript ingestion pipeline.

Handles fetching, chunking, and embedding transcripts.
"""

import logging
from datetime import date

from sqlalchemy.orm import Session

from src.earnings.models import Transcript
from src.earnings.service import get_transcript, list_available_transcripts
from src.rag.search import embed_transcript_chunks

logger = logging.getLogger(__name__)


async def ingest_transcript(
    db: Session,
    ticker: str,
    year: int,
    quarter: int,
    db_path: str = "verascore.db",
) -> dict:
    """
    Ingest a single transcript: fetch, chunk, and embed.

    Returns status dict with counts.
    """
    ticker = ticker.upper()

    # Check if already ingested
    existing = (
        db.query(Transcript)
        .filter(
            Transcript.ticker == ticker,
            Transcript.fiscal_year == year,
            Transcript.fiscal_quarter == quarter,
        )
        .first()
    )

    if existing and existing.chunks:
        # Already have chunks, check if embedded
        return {
            "status": "exists",
            "transcript_id": existing.id,
            "chunks": len(existing.chunks),
        }

    # Fetch and chunk transcript
    transcript = await get_transcript(db, ticker, year, quarter)
    if not transcript:
        return {"status": "not_found", "ticker": ticker, "year": year, "quarter": quarter}

    # Embed chunks
    embedded_count = await embed_transcript_chunks(db, transcript.id, db_path)

    return {
        "status": "ingested",
        "transcript_id": transcript.id,
        "chunks": len(transcript.chunks),
        "embedded": embedded_count,
    }


async def ingest_recent_transcripts(
    db: Session,
    ticker: str,
    count: int = 4,
    db_path: str = "verascore.db",
) -> list[dict]:
    """
    Ingest the most recent transcripts for a stock.

    Args:
        ticker: Stock ticker
        count: Number of recent transcripts to ingest
        db_path: Path to database

    Returns:
        List of status dicts for each transcript
    """
    ticker = ticker.upper()

    # Get available transcripts
    available = await list_available_transcripts(ticker)
    if not available:
        return [{"status": "no_transcripts", "ticker": ticker}]

    # Sort by date (most recent first) and take top N
    sorted_transcripts = sorted(
        available,
        key=lambda x: (x.get("year", 0), x.get("quarter", 0)),
        reverse=True,
    )[:count]

    results = []
    for t in sorted_transcripts:
        year = t.get("year")
        quarter = t.get("quarter")
        if year and quarter:
            result = await ingest_transcript(db, ticker, year, quarter, db_path)
            results.append(result)

    return results


async def ingest_watchlist_transcripts(
    db: Session,
    tickers: list[str],
    count_per_ticker: int = 2,
    db_path: str = "verascore.db",
) -> dict:
    """
    Ingest recent transcripts for all watchlist stocks.

    Args:
        tickers: List of stock tickers
        count_per_ticker: Number of transcripts per stock

    Returns:
        Summary dict with counts
    """
    total_ingested = 0
    total_chunks = 0
    errors = []

    for ticker in tickers:
        try:
            results = await ingest_recent_transcripts(
                db, ticker, count_per_ticker, db_path
            )
            for r in results:
                if r.get("status") == "ingested":
                    total_ingested += 1
                    total_chunks += r.get("chunks", 0)
        except Exception as e:
            logger.error(f"Error ingesting {ticker}: {e}")
            errors.append({"ticker": ticker, "error": str(e)})

    return {
        "tickers_processed": len(tickers),
        "transcripts_ingested": total_ingested,
        "total_chunks": total_chunks,
        "errors": errors,
    }
