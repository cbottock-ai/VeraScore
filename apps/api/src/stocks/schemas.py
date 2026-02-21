from pydantic import BaseModel


class StockSearchResult(BaseModel):
    ticker: str
    name: str
    exchange: str | None = None


class StockSearchResponse(BaseModel):
    results: list[StockSearchResult]
    query: str


class StockDetail(BaseModel):
    ticker: str
    name: str
    sector: str | None = None
    industry: str | None = None
    market_cap: float | None = None
    exchange: str | None = None
    price: float | None = None
    change_percent: float | None = None
    beta: float | None = None
    week_52_high: float | None = None
    week_52_low: float | None = None
    avg_volume: float | None = None
    dividend_yield: float | None = None


class ValuationMetrics(BaseModel):
    pe_ttm: float | None = None
    pe_ntm: float | None = None
    ps_ttm: float | None = None
    pb_ratio: float | None = None
    ev_to_ebitda: float | None = None
    ev_to_revenue: float | None = None
    peg_ratio: float | None = None
    eps_ttm: float | None = None
    eps_ntm: float | None = None


class GrowthMetrics(BaseModel):
    revenue_growth_yoy: float | None = None
    earnings_growth_yoy: float | None = None
    earnings_growth_quarterly: float | None = None
    revenue_growth_3y: float | None = None
    earnings_growth_3y: float | None = None
    revenue_growth_5y: float | None = None
    revenue_growth_10y: float | None = None


class ProfitabilityMetrics(BaseModel):
    gross_margin: float | None = None
    ebitda_margin: float | None = None
    operating_margin: float | None = None
    net_margin: float | None = None
    roe: float | None = None
    roa: float | None = None


class QualityMetrics(BaseModel):
    current_ratio: float | None = None
    quick_ratio: float | None = None
    debt_to_equity: float | None = None
    total_debt: float | None = None
    total_cash: float | None = None
    free_cash_flow: float | None = None
    operating_cash_flow: float | None = None
    fcf_yield: float | None = None


class MomentumMetrics(BaseModel):
    price_change_1m: float | None = None
    price_change_3m: float | None = None
    price_change_6m: float | None = None
    price_change_1y: float | None = None


class DividendMetrics(BaseModel):
    dividend_yield: float | None = None
    payout_ratio: float | None = None


class AnalystMetrics(BaseModel):
    target_mean: float | None = None
    target_median: float | None = None
    target_high: float | None = None
    target_low: float | None = None
    rating: str | None = None
    num_analysts: int | None = None


class FundamentalsResponse(BaseModel):
    ticker: str
    valuation: ValuationMetrics = ValuationMetrics()
    growth: GrowthMetrics = GrowthMetrics()
    profitability: ProfitabilityMetrics = ProfitabilityMetrics()
    quality: QualityMetrics = QualityMetrics()
    momentum: MomentumMetrics = MomentumMetrics()
    dividend: DividendMetrics = DividendMetrics()
    analyst: AnalystMetrics = AnalystMetrics()
