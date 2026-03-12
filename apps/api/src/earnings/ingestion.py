"""
Transcript ingestion pipeline.

Handles fetching, chunking, and embedding transcripts.
"""

import logging
from datetime import date, datetime

from sqlalchemy.orm import Session

from src.earnings.models import Transcript
from src.earnings.sec_edgar import extract_fiscal_period, fetch_earnings_8ks, fetch_exhibit_99_1
from src.earnings.service import get_transcript, list_available_transcripts
from src.rag.chunking import chunk_transcript
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


async def ingest_press_release_from_sec(
    db: Session,
    ticker: str,
    limit: int = 4,
    db_path: str = "verascore.db",
) -> list[dict]:
    """
    Ingest earnings press releases (Exhibit 99.1) from SEC EDGAR 8-K filings.

    Fetches the most recent earnings 8-Ks (Item 2.02), extracts the press release
    text, and stores as Transcript records for RAG search.
    """
    ticker = ticker.upper()
    results = []

    filings = await fetch_earnings_8ks(ticker, limit=limit)
    if not filings:
        return [{"status": "no_filings", "ticker": ticker}]

    for filing in filings:
        filing_date = filing.filing_date  # e.g. "2026-01-29"
        try:
            parsed_date = datetime.strptime(filing_date, "%Y-%m-%d").date()
        except ValueError:
            results.append({"status": "error", "filing_date": filing_date, "error": "bad date"})
            continue

        # Fetch the exhibit text first so we can extract the accurate fiscal period
        text = await fetch_exhibit_99_1(filing)
        if not text:
            results.append({
                "status": "no_text",
                "ticker": ticker,
                "filing_date": filing_date,
            })
            continue

        # Extract fiscal year/quarter from press release text (authoritative)
        fiscal_year, fiscal_quarter = extract_fiscal_period(text)
        if not fiscal_year or not fiscal_quarter:
            # Fall back to calendar approximation from filing date
            fiscal_quarter = (parsed_date.month - 1) // 3 + 1
            fiscal_year = parsed_date.year
            logger.warning(
                f"{ticker}: could not extract fiscal period from press release, "
                f"using calendar fallback Q{fiscal_quarter} {fiscal_year}"
            )

        # Skip if already ingested
        existing = (
            db.query(Transcript)
            .filter(
                Transcript.ticker == ticker,
                Transcript.fiscal_year == fiscal_year,
                Transcript.fiscal_quarter == fiscal_quarter,
                Transcript.source == "sec_edgar",
            )
            .first()
        )
        if existing and existing.chunks:
            results.append({
                "status": "exists",
                "ticker": ticker,
                "fiscal_year": fiscal_year,
                "fiscal_quarter": fiscal_quarter,
                "chunks": len(existing.chunks),
            })
            continue

        # Store as Transcript
        transcript = Transcript(
            ticker=ticker,
            fiscal_year=fiscal_year,
            fiscal_quarter=fiscal_quarter,
            call_date=parsed_date,
            full_text=text,
            source="sec_edgar",
        )
        db.add(transcript)
        db.flush()

        # Chunk and embed
        chunks = chunk_transcript(text)
        from src.earnings.models import TranscriptChunk
        for chunk in chunks:
            db.add(TranscriptChunk(
                transcript_id=transcript.id,
                chunk_index=chunk.index,
                content=chunk.content,
                speaker=chunk.speaker,
                section=chunk.section,
            ))
        db.commit()
        db.refresh(transcript)

        embedded = await embed_transcript_chunks(db, transcript.id, db_path)

        results.append({
            "status": "ingested",
            "ticker": ticker,
            "fiscal_year": fiscal_year,
            "fiscal_quarter": fiscal_quarter,
            "filing_date": filing_date,
            "chunks": len(transcript.chunks),
            "embedded": embedded,
        })

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
