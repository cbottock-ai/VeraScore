"""
Pydantic schemas for earnings API responses.
"""

from datetime import date
from pydantic import BaseModel


class EarningsRecord(BaseModel):
    """A single earnings record."""

    ticker: str
    fiscal_date: str
    fiscal_quarter: int | None = None
    fiscal_year: int | None = None
    eps_estimated: float | None = None
    eps_actual: float | None = None
    eps_surprise: float | None = None
    eps_surprise_pct: float | None = None
    revenue_estimated: float | None = None
    revenue_actual: float | None = None
    revenue_surprise_pct: float | None = None
    report_time: str | None = None


class EarningsHistoryResponse(BaseModel):
    """Response for earnings history query."""

    ticker: str
    earnings: list[dict]  # Raw earnings dicts for flexibility
    analysis: dict | None = None


class UpcomingEarning(BaseModel):
    """An upcoming earnings announcement."""

    symbol: str
    name: str | None = None
    date: str
    time: str | None = None  # 'bmo', 'amc', or None
    eps_estimated: float | None = None
    revenue_estimated: float | None = None


class EarningsCalendarResponse(BaseModel):
    """Response for earnings calendar query."""

    from_date: str
    to_date: str
    earnings: list[UpcomingEarning]


class TranscriptChunkResult(BaseModel):
    """A search result from transcript RAG."""

    content: str
    score: float
    ticker: str | None = None
    speaker: str | None = None
    section: str | None = None
    fiscal_year: int | None = None
    fiscal_quarter: int | None = None
    call_date: str | None = None


class TranscriptSearchResponse(BaseModel):
    """Response for transcript search."""

    query: str
    results: list[TranscriptChunkResult]


class TranscriptSummaryResponse(BaseModel):
    """Response for transcript summary."""

    ticker: str
    fiscal_year: int
    fiscal_quarter: int
    call_date: str
    summary: str
    key_points: list[str] | None = None


class EarningsAnalysis(BaseModel):
    """Earnings pattern analysis."""

    ticker: str
    total_quarters: int
    eps_beats: int
    eps_misses: int
    eps_beat_rate: float | None = None
    avg_eps_surprise_pct: float | None = None
    revenue_beats: int
    revenue_misses: int
    revenue_beat_rate: float | None = None
