export interface StockSearchResult {
  ticker: string
  name: string
  exchange: string | null
}

export interface StockSearchResponse {
  results: StockSearchResult[]
  query: string
}

export interface StockDetail {
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  market_cap: number | null
  exchange: string | null
  price: number | null
  change_percent: number | null
  beta: number | null
  week_52_high: number | null
  week_52_low: number | null
  avg_volume: number | null
  dividend_yield: number | null
}

export interface ValuationMetrics {
  pe_ttm: number | null
  pe_ntm: number | null
  ps_ttm: number | null
  pb_ratio: number | null
  ev_to_ebitda: number | null
  ev_to_revenue: number | null
  peg_ratio: number | null
  eps_ttm: number | null
  eps_ntm: number | null
}

export interface GrowthMetrics {
  revenue_growth_yoy: number | null
  earnings_growth_yoy: number | null
  earnings_growth_quarterly: number | null
  revenue_growth_3y: number | null
  earnings_growth_3y: number | null
  revenue_growth_5y: number | null
  revenue_growth_10y: number | null
}

export interface ProfitabilityMetrics {
  gross_margin: number | null
  ebitda_margin: number | null
  operating_margin: number | null
  net_margin: number | null
  roe: number | null
  roa: number | null
}

export interface QualityMetrics {
  current_ratio: number | null
  quick_ratio: number | null
  debt_to_equity: number | null
  total_debt: number | null
  total_cash: number | null
  free_cash_flow: number | null
  operating_cash_flow: number | null
  fcf_yield: number | null
}

export interface MomentumMetrics {
  price_change_1m: number | null
  price_change_3m: number | null
  price_change_6m: number | null
  price_change_1y: number | null
}

export interface DividendMetrics {
  dividend_yield: number | null
  payout_ratio: number | null
}

export interface AnalystMetrics {
  target_mean: number | null
  target_median: number | null
  target_high: number | null
  target_low: number | null
  rating: string | null
  num_analysts: number | null
}

export interface FundamentalsResponse {
  ticker: string
  valuation: ValuationMetrics
  growth: GrowthMetrics
  profitability: ProfitabilityMetrics
  quality: QualityMetrics
  momentum: MomentumMetrics
  dividend: DividendMetrics
  analyst: AnalystMetrics
}
