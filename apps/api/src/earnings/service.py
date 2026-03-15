"""
Earnings data service.

Handles fetching, caching, and querying earnings data.
"""

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from src.core.data_providers.fmp import (
    fmp_analyst_estimates,
    fmp_earnings_calendar,
    fmp_earnings_historical,
    fmp_transcript,
    fmp_transcript_list,
)
from src.earnings.models import Earnings, Transcript, TranscriptChunk
from src.rag.chunking import chunk_transcript


async def get_earnings_calendar(
    db: Session,
    from_date: date | None = None,
    to_date: date | None = None,
    tickers: list[str] | None = None,
) -> list[dict]:
    """
    Get upcoming earnings announcements.

    Args:
        from_date: Start date, defaults to today
        to_date: End date, defaults to 14 days from now
        tickers: Optional filter to specific tickers
    """
    from_date = from_date or date.today()
    to_date = to_date or (date.today() + timedelta(days=14))

    data = await fmp_earnings_calendar(
        from_date=from_date.isoformat(),
        to_date=to_date.isoformat(),
    )

    if tickers:
        tickers_upper = {t.upper() for t in tickers}
        data = [d for d in data if d.get("symbol", "").upper() in tickers_upper]

    return data


async def get_earnings_history(
    db: Session,
    ticker: str,
    limit: int = 12,
) -> list[dict]:
    """
    Get historical earnings for a stock.

    Returns cached data if available, otherwise fetches and caches.
    """
    ticker = ticker.upper()

    # Check cache first
    cached = (
        db.query(Earnings)
        .filter(Earnings.ticker == ticker)
        .order_by(Earnings.fiscal_date.desc())
        .limit(limit)
        .all()
    )

    if cached:
        return [
            {
                "ticker": e.ticker,
                "fiscal_date": e.fiscal_date.isoformat(),
                "fiscal_quarter": e.fiscal_quarter,
                "fiscal_year": e.fiscal_year,
                "eps_estimated": e.eps_estimated,
                "eps_actual": e.eps_actual,
                "eps_surprise": e.eps_surprise,
                "eps_surprise_pct": e.eps_surprise_pct,
                "revenue_estimated": e.revenue_estimated,
                "revenue_actual": e.revenue_actual,
                "revenue_surprise_pct": e.revenue_surprise_pct,
                "report_time": e.report_time,
            }
            for e in cached
        ]

    # Fetch from FMP
    data = await fmp_earnings_historical(ticker, limit=limit)

    # Cache in database
    for item in data:
        fiscal_date_str = item.get("date") or item.get("fiscalDateEnding")
        if not fiscal_date_str:
            continue

        try:
            fiscal_date = datetime.strptime(fiscal_date_str, "%Y-%m-%d").date()
        except ValueError:
            continue

        # Determine quarter from date
        quarter = (fiscal_date.month - 1) // 3 + 1

        earnings = Earnings(
            ticker=ticker,
            fiscal_date=fiscal_date,
            fiscal_quarter=quarter,
            fiscal_year=fiscal_date.year,
            eps_estimated=item.get("estimatedEPS") or item.get("epsEstimated"),
            eps_actual=item.get("actualEPS") or item.get("actualEarningResult"),
            eps_surprise=item.get("epsSurprise"),
            eps_surprise_pct=item.get("surprisePercentage"),
            revenue_estimated=item.get("revenueEstimated"),
            revenue_actual=item.get("revenue"),
            report_time=item.get("time"),
        )
        db.add(earnings)

    db.commit()

    # Return the fetched data formatted
    return [
        {
            "ticker": ticker,
            "fiscal_date": item.get("date") or item.get("fiscalDateEnding"),
            "eps_estimated": item.get("estimatedEPS") or item.get("epsEstimated"),
            "eps_actual": item.get("actualEPS") or item.get("actualEarningResult"),
            "eps_surprise": item.get("epsSurprise"),
            "eps_surprise_pct": item.get("surprisePercentage"),
            "revenue_estimated": item.get("revenueEstimated"),
            "revenue_actual": item.get("revenue"),
        }
        for item in data
    ]


async def get_transcript(
    db: Session,
    ticker: str,
    year: int,
    quarter: int,
) -> Transcript | None:
    """
    Get or fetch an earnings transcript.

    Returns cached transcript if available, otherwise fetches and caches.
    """
    ticker = ticker.upper()

    # Check cache
    cached = (
        db.query(Transcript)
        .filter(
            Transcript.ticker == ticker,
            Transcript.fiscal_year == year,
            Transcript.fiscal_quarter == quarter,
        )
        .first()
    )

    if cached:
        return cached

    # Fetch from FMP
    data = await fmp_transcript(ticker, year, quarter)
    if not data or not data.get("content"):
        return None

    # Parse date
    call_date_str = data.get("date", "")
    try:
        call_date = datetime.strptime(call_date_str[:10], "%Y-%m-%d").date()
    except (ValueError, IndexError):
        call_date = date(year, quarter * 3, 1)

    # Create transcript
    transcript = Transcript(
        ticker=ticker,
        fiscal_year=year,
        fiscal_quarter=quarter,
        call_date=call_date,
        full_text=data.get("content", ""),
    )
    db.add(transcript)
    db.flush()  # Get the ID

    # Chunk the transcript
    chunks = chunk_transcript(transcript.full_text)
    for chunk in chunks:
        db_chunk = TranscriptChunk(
            transcript_id=transcript.id,
            chunk_index=chunk.index,
            content=chunk.content,
            speaker=chunk.speaker,
            section=chunk.section,
        )
        db.add(db_chunk)

    db.commit()
    db.refresh(transcript)

    return transcript


async def get_analyst_estimates(ticker: str) -> list[dict]:
    """Get analyst estimates for upcoming quarters."""
    return await fmp_analyst_estimates(ticker)


async def list_available_transcripts(ticker: str) -> list[dict]:
    """Get list of available transcripts for a stock."""
    return await fmp_transcript_list(ticker)


def analyze_earnings_pattern(earnings: list[dict]) -> dict:
    """
    Analyze earnings beat/miss patterns.

    Returns summary statistics about earnings performance.
    """
    if not earnings:
        return {"error": "No earnings data"}

    beats = 0
    misses = 0
    total_surprise_pct = 0
    revenue_beats = 0
    revenue_misses = 0

    for e in earnings:
        eps_surprise = e.get("eps_surprise_pct") or e.get("eps_surprise")
        if eps_surprise is not None:
            if eps_surprise > 0:
                beats += 1
            elif eps_surprise < 0:
                misses += 1
            total_surprise_pct += eps_surprise

        rev_surprise = e.get("revenue_surprise_pct")
        if rev_surprise is not None:
            if rev_surprise > 0:
                revenue_beats += 1
            elif rev_surprise < 0:
                revenue_misses += 1

    total = len(earnings)
    eps_total = beats + misses

    return {
        "total_quarters": total,
        "eps_beats": beats,
        "eps_misses": misses,
        "eps_beat_rate": round(beats / eps_total * 100, 1) if eps_total > 0 else None,
        "avg_eps_surprise_pct": round(total_surprise_pct / eps_total, 2) if eps_total > 0 else None,
        "revenue_beats": revenue_beats,
        "revenue_misses": revenue_misses,
        "revenue_beat_rate": round(revenue_beats / (revenue_beats + revenue_misses) * 100, 1)
        if (revenue_beats + revenue_misses) > 0
        else None,
    }


# --- Functions for chat tools (match expected signatures) ---

from src.earnings.schemas import (
    EarningsAnalysis,
    EarningsCalendarResponse,
    EarningsHistoryResponse,
    UpcomingEarning,
)

# Save reference to internal function before overwriting
_get_earnings_history_internal = get_earnings_history


async def get_earnings_history(
    ticker: str,
    db: Session,
    limit: int = 12,
) -> EarningsHistoryResponse:
    """Get earnings history formatted for chat tool response."""
    ticker = ticker.upper()
    earnings = await _get_earnings_history_internal(db, ticker, limit)
    analysis = analyze_earnings_pattern(earnings)

    return EarningsHistoryResponse(
        ticker=ticker,
        earnings=earnings,
        analysis=analysis if "error" not in analysis else None,
    )


async def get_upcoming_earnings(
    db: Session,
    days: int = 7,
) -> EarningsCalendarResponse:
    """Get upcoming earnings formatted for chat tool response."""
    from_date = date.today()
    to_date = from_date + timedelta(days=days)

    data = await get_earnings_calendar(db, from_date, to_date)

    earnings = [
        UpcomingEarning(
            symbol=e.get("symbol", ""),
            name=e.get("name"),
            date=e.get("date", ""),
            time=e.get("time"),
            eps_estimated=e.get("epsEstimated"),
            revenue_estimated=e.get("revenueEstimated"),
        )
        for e in data
    ]

    return EarningsCalendarResponse(
        from_date=from_date.isoformat(),
        to_date=to_date.isoformat(),
        earnings=earnings,
    )


def analyze_earnings_surprises(
    ticker: str,
    db: Session,
    quarters: int = 12,
) -> EarningsAnalysis | None:
    """Analyze earnings surprises for chat tool response."""
    ticker = ticker.upper()

    # Get cached earnings
    cached = (
        db.query(Earnings)
        .filter(Earnings.ticker == ticker)
        .order_by(Earnings.fiscal_date.desc())
        .limit(quarters)
        .all()
    )

    if not cached:
        return None

    earnings_dicts = [
        {
            "eps_surprise_pct": e.eps_surprise_pct,
            "revenue_surprise_pct": e.revenue_surprise_pct,
        }
        for e in cached
    ]

    analysis = analyze_earnings_pattern(earnings_dicts)
    if "error" in analysis:
        return None

    return EarningsAnalysis(
        ticker=ticker,
        total_quarters=analysis["total_quarters"],
        eps_beats=analysis["eps_beats"],
        eps_misses=analysis["eps_misses"],
        eps_beat_rate=analysis.get("eps_beat_rate"),
        avg_eps_surprise_pct=analysis.get("avg_eps_surprise_pct"),
        revenue_beats=analysis["revenue_beats"],
        revenue_misses=analysis["revenue_misses"],
        revenue_beat_rate=analysis.get("revenue_beat_rate"),
    )


def compute_earnings_quality_metrics(db: Session, ticker: str, limit: int = 12) -> dict:
    """
    Compute earnings quality metrics for the scoring engine.

    Returns a dict with keys: eps_beat_rate, revenue_beat_rate,
    avg_eps_surprise_pct, eps_beat_streak.
    All values are floats or None if insufficient data.
    """
    ticker = ticker.upper()
    rows = (
        db.query(Earnings)
        .filter(Earnings.ticker == ticker)
        .order_by(Earnings.fiscal_date.desc())
        .limit(limit)
        .all()
    )

    if not rows:
        return {}

    eps_beats = 0
    eps_misses = 0
    rev_beats = 0
    rev_misses = 0
    surprise_sum = 0.0
    surprise_count = 0
    streak = 0
    streak_broken = False

    for row in rows:
        # EPS beat/miss
        if row.eps_surprise_pct is not None:
            if row.eps_surprise_pct > 0:
                eps_beats += 1
                if not streak_broken:
                    streak += 1
            else:
                eps_misses += 1
                streak_broken = True
            surprise_sum += row.eps_surprise_pct
            surprise_count += 1
        elif row.eps_surprise is not None and row.eps_estimated and row.eps_estimated != 0:
            # Compute pct if not stored
            pct = (row.eps_surprise / abs(row.eps_estimated)) * 100
            if pct > 0:
                eps_beats += 1
                if not streak_broken:
                    streak += 1
            else:
                eps_misses += 1
                streak_broken = True
            surprise_sum += pct
            surprise_count += 1

        # Revenue beat/miss
        if row.revenue_surprise_pct is not None:
            if row.revenue_surprise_pct > 0:
                rev_beats += 1
            else:
                rev_misses += 1
        elif row.revenue_actual and row.revenue_estimated and row.revenue_estimated > 0:
            if row.revenue_actual >= row.revenue_estimated:
                rev_beats += 1
            else:
                rev_misses += 1

    eps_total = eps_beats + eps_misses
    rev_total = rev_beats + rev_misses

    # Most recent press release sentiment score
    recent_sentiment = (
        db.query(Transcript.sentiment_score)
        .filter(
            Transcript.ticker == ticker,
            Transcript.sentiment_score.isnot(None),
        )
        .order_by(Transcript.fiscal_year.desc(), Transcript.fiscal_quarter.desc())
        .scalar()
    )

    return {
        "eps_beat_rate": round(eps_beats / eps_total * 100, 1) if eps_total > 0 else None,
        "revenue_beat_rate": round(rev_beats / rev_total * 100, 1) if rev_total > 0 else None,
        "avg_eps_surprise_pct": round(surprise_sum / surprise_count, 2) if surprise_count > 0 else None,
        "eps_beat_streak": streak if not streak_broken or streak > 0 else 0,
        "sentiment_score": float(recent_sentiment) if recent_sentiment is not None else None,
    }
