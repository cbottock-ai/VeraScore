from pydantic import BaseModel


class EarningsRecord(BaseModel):
    ticker: str
    fiscal_date: str
    fiscal_quarter: int
    fiscal_year: int
    eps_estimated: float | None = None
    eps_actual: float | None = None
    eps_surprise: float | None = None
    eps_surprise_pct: float | None = None
    revenue_estimated: float | None = None
    revenue_actual: float | None = None
    revenue_surprise_pct: float | None = None
    report_time: str | None = None


class EarningsHistoryResponse(BaseModel):
    ticker: str
    records: list[EarningsRecord]


class UpcomingEarnings(BaseModel):
    ticker: str
    company_name: str | None = None
    fiscal_date: str
    eps_estimated: float | None = None
    revenue_estimated: float | None = None
    report_time: str | None = None


class UpcomingEarningsResponse(BaseModel):
    days: int
    earnings: list[UpcomingEarnings]


class TranscriptSearchResult(BaseModel):
    ticker: str
    fiscal_quarter: int
    fiscal_year: int
    chunk_content: str
    speaker: str | None = None
    section: str | None = None
    relevance_score: float


class TranscriptSearchResponse(BaseModel):
    query: str
    results: list[TranscriptSearchResult]


class TranscriptSummary(BaseModel):
    ticker: str
    fiscal_quarter: int
    fiscal_year: int
    call_date: str | None = None
    summary: str
    key_topics: list[str]


class EarningsSurpriseAnalysis(BaseModel):
    ticker: str
    total_quarters: int
    eps_beat_count: int
    eps_miss_count: int
    eps_meet_count: int
    eps_beat_rate: float
    avg_eps_surprise_pct: float
    revenue_beat_count: int
    revenue_miss_count: int
    revenue_beat_rate: float
    avg_revenue_surprise_pct: float
    trend: str  # "improving", "declining", "stable"
