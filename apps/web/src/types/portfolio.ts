export interface PortfolioSummary {
  id: number
  name: string
  description: string | null
  holdings_count: number
  total_value: number | null
  total_gain_loss: number | null
  total_gain_loss_pct: number | null
}

export interface PortfolioListResponse {
  portfolios: PortfolioSummary[]
}

export interface HoldingDetail {
  id: number
  ticker: string
  shares: number
  cost_basis: number
  cost_per_share: number | null
  purchase_date: string | null
  notes: string | null
  // Price data
  current_price: number | null
  current_value: number | null
  day_change: number | null
  day_change_pct: number | null
  // Gain/loss from cost basis
  gain_loss: number | null
  gain_loss_pct: number | null
  // Stock info
  sector: string | null
  market_cap: number | null
  // Fundamentals
  pe_ratio: number | null
  revenue_ttm: number | null
  eps: number | null
  dividend_yield: number | null
  // VeraScore
  score: number | null
}

export interface PortfolioMetrics {
  total_value: number
  total_cost_basis: number
  total_gain_loss: number
  total_gain_loss_pct: number
  holdings_count: number
  sector_allocation: Record<string, number>
  top_holdings: { ticker: string; value: number | null; pct: number }[]
  weighted_score: number | null
}

export interface PortfolioDetailResponse {
  id: number
  name: string
  description: string | null
  metrics: PortfolioMetrics | null
  holdings: HoldingDetail[]
}

export interface PortfolioCreate {
  name: string
  description?: string
}

export interface HoldingCreate {
  ticker: string
  shares: number
  cost_basis: number
  purchase_date?: string
  notes?: string
}

export interface CsvImportResult {
  imported: number
  errors: string[]
}

// Dynamic column support
export interface ColumnDef {
  id: string
  label: string
  source: string
  format: 'string' | 'number' | 'currency' | 'percent' | 'large_number' | 'score' | 'days' | 'ratio'
  description: string
}

export interface PortfolioDynamicMetrics {
  total_value: number
  total_cost_basis: number
  total_gain_loss: number
  total_gain_loss_pct: number
  holdings_count: number
  weighted_score: number | null
}

export interface PortfolioDynamicResponse {
  id: number
  name: string
  description: string | null
  metrics: PortfolioDynamicMetrics
  holdings: Record<string, unknown>[]  // Dynamic fields based on columns
  columns: string[]
}
