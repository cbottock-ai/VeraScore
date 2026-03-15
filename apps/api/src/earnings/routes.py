"""Earnings REST API routes."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.earnings.schemas import EarningsAnalysis, EarningsHistoryResponse, EarningsCalendarResponse, UpcomingEarning
from src.earnings.service import (
    _get_earnings_history_internal,
    analyze_earnings_pattern,
    analyze_earnings_surprises,
    get_earnings_calendar,
)

router = APIRouter(prefix="/earnings", tags=["earnings"])


@router.get("/calendar", response_model=EarningsCalendarResponse)
async def earnings_calendar(
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    tickers: str | None = Query(None, description="Comma-separated tickers"),
    db: Session = Depends(get_db),
):
    from_dt = date.fromisoformat(from_date) if from_date else date.today()
    to_dt = date.fromisoformat(to_date) if to_date else date.today() + timedelta(days=14)
    ticker_list = [t.strip().upper() for t in tickers.split(",")] if tickers else None

    raw = await get_earnings_calendar(db, from_date=from_dt, to_date=to_dt, tickers=ticker_list)

    earnings = [
        UpcomingEarning(
            symbol=e.get("symbol", ""),
            name=e.get("name"),
            date=e.get("date", ""),
            time=e.get("time"),
            eps_estimated=e.get("epsEstimated") or e.get("eps_estimated"),
            revenue_estimated=e.get("revenueEstimated") or e.get("revenue_estimated"),
        )
        for e in raw
        if e.get("date")
    ]

    return EarningsCalendarResponse(
        from_date=from_dt.isoformat(),
        to_date=to_dt.isoformat(),
        earnings=earnings,
    )


@router.get("/{ticker}/history", response_model=EarningsHistoryResponse)
async def earnings_history(
    ticker: str,
    limit: int = Query(12, ge=1, le=40),
    db: Session = Depends(get_db),
):
    ticker = ticker.upper()
    earnings = await _get_earnings_history_internal(db, ticker, limit=limit)
    analysis = analyze_earnings_pattern(earnings)
    return EarningsHistoryResponse(
        ticker=ticker,
        earnings=earnings,
        analysis=analysis if "error" not in analysis else None,
    )


@router.get("/{ticker}/analysis", response_model=EarningsAnalysis)
async def earnings_analysis(
    ticker: str,
    db: Session = Depends(get_db),
):
    ticker = ticker.upper()
    result = analyze_earnings_surprises(ticker, db)
    if result is None:
        raise HTTPException(status_code=404, detail="No earnings data found")
    return result
