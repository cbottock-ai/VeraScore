from pydantic import BaseModel


class PortfolioCreate(BaseModel):
    name: str
    description: str | None = None


class PortfolioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class PortfolioSummary(BaseModel):
    id: int
    name: str
    description: str | None = None
    holdings_count: int = 0
    total_value: float | None = None
    total_gain_loss: float | None = None
    total_gain_loss_pct: float | None = None


class PortfolioListResponse(BaseModel):
    portfolios: list[PortfolioSummary]


class HoldingCreate(BaseModel):
    ticker: str
    shares: float
    cost_basis: float
    purchase_date: str | None = None
    notes: str | None = None


class HoldingUpdate(BaseModel):
    shares: float | None = None
    cost_basis: float | None = None
    purchase_date: str | None = None
    notes: str | None = None


class HoldingDetail(BaseModel):
    id: int
    ticker: str
    shares: float
    cost_basis: float
    cost_per_share: float | None = None
    purchase_date: str | None = None
    notes: str | None = None
    current_price: float | None = None
    current_value: float | None = None
    gain_loss: float | None = None
    gain_loss_pct: float | None = None
    sector: str | None = None
    score: float | None = None


class HoldingsResponse(BaseModel):
    holdings: list[HoldingDetail]


class PortfolioMetrics(BaseModel):
    total_value: float
    total_cost_basis: float
    total_gain_loss: float
    total_gain_loss_pct: float
    holdings_count: int
    sector_allocation: dict[str, float]  # sector -> percentage
    top_holdings: list[dict]  # [{ticker, pct}, ...]
    weighted_score: float | None = None


class PortfolioDetailResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    metrics: PortfolioMetrics | None = None
    holdings: list[HoldingDetail]


class CsvImportResult(BaseModel):
    imported: int
    errors: list[str]
