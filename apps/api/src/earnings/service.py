import logging
from datetime import datetime, timedelta

from sqlalchemy import and_, desc
from sqlalchemy.orm import Session

from src.core.data_providers.fmp import (
    fmp_earnings_calendar,
    fmp_earnings_historical,
    fmp_transcript,
)
from src.earnings.models import Earnings, Transcript
from src.earnings.schemas import (
    EarningsHistoryResponse,
    EarningsRecord,
    EarningsSurpriseAnalysis,
    UpcomingEarnings,
    UpcomingEarningsResponse,
)

logger = logging.getLogger(__name__)

# Cache duration in hours
EARNINGS_CACHE_HOURS = 24


async def get_earnings_history(
    ticker: str, db: Session, limit: int = 12
) -> EarningsHistoryResponse:
    """Get historical earnings for a ticker, fetching from API if needed.

    Uses earnings-calendar endpoint which provides both estimates and actuals,
    allowing for proper surprise calculations.
    """
    ticker = ticker.upper()

    # Check cache
    cutoff = datetime.utcnow() - timedelta(hours=EARNINGS_CACHE_HOURS)
    cached = (
        db.query(Earnings)
        .filter(and_(Earnings.ticker == ticker, Earnings.fetched_at > cutoff))
        .order_by(desc(Earnings.fiscal_date))
        .limit(limit)
        .all()
    )

    if cached and len(cached) >= limit:
        records = [
            EarningsRecord(
                ticker=e.ticker,
                fiscal_date=e.fiscal_date,
                fiscal_quarter=e.fiscal_quarter,
                fiscal_year=e.fiscal_year,
                eps_estimated=e.eps_estimated,
                eps_actual=e.eps_actual,
                eps_surprise=e.eps_surprise,
                eps_surprise_pct=e.eps_surprise_pct,
                revenue_estimated=e.revenue_estimated,
                revenue_actual=e.revenue_actual,
                revenue_surprise_pct=e.revenue_surprise_pct,
                report_time=e.report_time,
            )
            for e in cached
        ]
        return EarningsHistoryResponse(ticker=ticker, records=records)

    # Fetch from API (earnings-calendar endpoint with historical range)
    api_data = await fmp_earnings_historical(ticker, limit)

    records = []
    for item in api_data:
        fiscal_date = item.get("date", "")

        # Parse quarter and year from date
        try:
            dt = datetime.strptime(fiscal_date, "%Y-%m-%d")
            fiscal_quarter = (dt.month - 1) // 3 + 1
            fiscal_year = dt.year
        except ValueError:
            fiscal_quarter = 0
            fiscal_year = 0

        # Get estimates and actuals directly from earnings-calendar
        eps_estimated = item.get("epsEstimated")
        eps_actual = item.get("epsActual")
        revenue_estimated = item.get("revenueEstimated")
        revenue_actual = item.get("revenueActual")

        # Calculate surprises
        eps_surprise = None
        eps_surprise_pct = None
        if eps_estimated is not None and eps_actual is not None:
            eps_surprise = eps_actual - eps_estimated
            if eps_estimated != 0:
                eps_surprise_pct = (eps_surprise / abs(eps_estimated)) * 100

        revenue_surprise_pct = None
        if revenue_estimated and revenue_actual and revenue_estimated != 0:
            revenue_surprise_pct = (
                (revenue_actual - revenue_estimated) / revenue_estimated
            ) * 100

        # Save to DB
        earnings = Earnings(
            ticker=ticker,
            fiscal_date=fiscal_date,
            fiscal_quarter=fiscal_quarter,
            fiscal_year=fiscal_year,
            eps_estimated=eps_estimated,
            eps_actual=eps_actual,
            eps_surprise=eps_surprise,
            eps_surprise_pct=eps_surprise_pct,
            revenue_estimated=revenue_estimated,
            revenue_actual=revenue_actual,
            revenue_surprise_pct=revenue_surprise_pct,
        )
        db.add(earnings)

        records.append(
            EarningsRecord(
                ticker=ticker,
                fiscal_date=fiscal_date,
                fiscal_quarter=fiscal_quarter,
                fiscal_year=fiscal_year,
                eps_estimated=eps_estimated,
                eps_actual=eps_actual,
                eps_surprise=eps_surprise,
                eps_surprise_pct=eps_surprise_pct,
                revenue_estimated=revenue_estimated,
                revenue_actual=revenue_actual,
                revenue_surprise_pct=revenue_surprise_pct,
            )
        )

    db.commit()
    return EarningsHistoryResponse(ticker=ticker, records=records)


async def get_upcoming_earnings(db: Session, days: int = 7) -> UpcomingEarningsResponse:
    """Get upcoming earnings for the next N days."""
    today = datetime.utcnow().date()
    end_date = today + timedelta(days=days)

    api_data = await fmp_earnings_calendar(
        today.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")
    )

    earnings = []
    for item in api_data:
        earnings.append(
            UpcomingEarnings(
                ticker=item.get("symbol", ""),
                company_name=item.get("name"),
                fiscal_date=item.get("date", ""),
                eps_estimated=item.get("epsEstimated"),
                revenue_estimated=item.get("revenueEstimated"),
                report_time=item.get("time"),
            )
        )

    return UpcomingEarningsResponse(days=days, earnings=earnings)


async def get_transcript(
    ticker: str, year: int, quarter: int, db: Session
) -> Transcript | None:
    """Get transcript, fetching from API if not cached."""
    ticker = ticker.upper()

    # Check cache
    cached = (
        db.query(Transcript)
        .filter(
            and_(
                Transcript.ticker == ticker,
                Transcript.fiscal_year == year,
                Transcript.fiscal_quarter == quarter,
            )
        )
        .first()
    )

    if cached:
        return cached

    # Fetch from API
    api_data = await fmp_transcript(ticker, year, quarter)
    if not api_data:
        return None

    transcript = Transcript(
        ticker=ticker,
        fiscal_quarter=quarter,
        fiscal_year=year,
        call_date=api_data.get("date"),
        full_text=api_data.get("content"),
        source="fmp",
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)

    return transcript


def analyze_earnings_surprises(
    ticker: str, db: Session, limit: int = 12
) -> EarningsSurpriseAnalysis | None:
    """Analyze earnings surprise patterns."""
    ticker = ticker.upper()

    earnings = (
        db.query(Earnings)
        .filter(Earnings.ticker == ticker)
        .order_by(desc(Earnings.fiscal_date))
        .limit(limit)
        .all()
    )

    if not earnings:
        return None

    eps_beat = 0
    eps_miss = 0
    eps_meet = 0
    eps_surprises = []

    revenue_beat = 0
    revenue_miss = 0
    revenue_surprises = []

    for e in earnings:
        if e.eps_surprise_pct is not None:
            eps_surprises.append(e.eps_surprise_pct)
            if e.eps_surprise_pct > 1:
                eps_beat += 1
            elif e.eps_surprise_pct < -1:
                eps_miss += 1
            else:
                eps_meet += 1

        if e.revenue_surprise_pct is not None:
            revenue_surprises.append(e.revenue_surprise_pct)
            if e.revenue_surprise_pct > 0:
                revenue_beat += 1
            else:
                revenue_miss += 1

    total = len(earnings)
    eps_beat_rate = eps_beat / total if total > 0 else 0
    revenue_beat_rate = revenue_beat / total if total > 0 else 0

    avg_eps_surprise = sum(eps_surprises) / len(eps_surprises) if eps_surprises else 0
    avg_rev_surprise = (
        sum(revenue_surprises) / len(revenue_surprises) if revenue_surprises else 0
    )

    # Determine trend by comparing recent vs older
    recent_surprises = eps_surprises[: len(eps_surprises) // 2]
    older_surprises = eps_surprises[len(eps_surprises) // 2 :]

    if recent_surprises and older_surprises:
        recent_avg = sum(recent_surprises) / len(recent_surprises)
        older_avg = sum(older_surprises) / len(older_surprises)
        if recent_avg > older_avg + 2:
            trend = "improving"
        elif recent_avg < older_avg - 2:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"

    return EarningsSurpriseAnalysis(
        ticker=ticker,
        total_quarters=total,
        eps_beat_count=eps_beat,
        eps_miss_count=eps_miss,
        eps_meet_count=eps_meet,
        eps_beat_rate=eps_beat_rate,
        avg_eps_surprise_pct=avg_eps_surprise,
        revenue_beat_count=revenue_beat,
        revenue_miss_count=revenue_miss,
        revenue_beat_rate=revenue_beat_rate,
        avg_revenue_surprise_pct=avg_rev_surprise,
        trend=trend,
    )
