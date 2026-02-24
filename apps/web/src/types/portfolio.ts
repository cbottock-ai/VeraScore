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
  current_price: number | null
  current_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
  sector: string | null
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
