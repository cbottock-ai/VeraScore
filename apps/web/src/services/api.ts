import axios from 'axios'
import type { StockSearchResponse, StockDetail, FundamentalsResponse, StockScoresResponse } from '@/types/stock'
import type { ConversationSummary, ConversationDetail, LLMProviderInfo, Citation } from '@/types/chat'
import type {
  PortfolioListResponse,
  PortfolioDetailResponse,
  PortfolioDynamicResponse,
  PortfolioSummary,
  PortfolioCreate,
  HoldingDetail,
  HoldingCreate,
  CsvImportResult,
  ColumnDef,
} from '@/types/portfolio'

const api = axios.create({
  baseURL: '/api',
})

// Auth token management for Clerk integration
let getAuthToken: (() => Promise<string | null>) | null = null

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter
}

// Add auth header to all requests when token is available
api.interceptors.request.use(async (config) => {
  if (getAuthToken) {
    const token = await getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// --- Stocks ---

export async function searchStocks(query: string, limit = 10): Promise<StockSearchResponse> {
  const { data } = await api.get<StockSearchResponse>('/stocks/search', {
    params: { q: query, limit },
  })
  return data
}

export async function getStock(ticker: string): Promise<StockDetail> {
  const { data } = await api.get<StockDetail>(`/stocks/${ticker}`)
  return data
}

export async function getFundamentals(ticker: string): Promise<FundamentalsResponse> {
  const { data } = await api.get<FundamentalsResponse>(`/stocks/${ticker}/fundamentals`)
  return data
}

export async function getScores(ticker: string): Promise<StockScoresResponse> {
  const { data } = await api.get<StockScoresResponse>(`/scoring/stocks/${ticker}/scores`)
  return data
}

export interface MarketIndex {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
}

export async function getMarketIndices(): Promise<MarketIndex[]> {
  const { data } = await api.get<MarketIndex[]>('/stocks/market/indices')
  return data
}

export interface StockQuote {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
}

export async function getQuotes(tickers: string[]): Promise<StockQuote[]> {
  const { data } = await api.post<StockQuote[]>('/stocks/quotes', tickers)
  return data
}

// --- Portfolios ---

export async function listPortfolios(): Promise<PortfolioListResponse> {
  const { data } = await api.get<PortfolioListResponse>('/portfolios')
  return data
}

export async function getAvailableColumns(): Promise<ColumnDef[]> {
  const { data } = await api.get<{ columns: ColumnDef[] }>('/portfolios/columns')
  return data.columns
}

export async function getPortfolio(id: number): Promise<PortfolioDetailResponse> {
  const { data } = await api.get<PortfolioDetailResponse>(`/portfolios/${id}`)
  return data
}

export async function getPortfolioDynamic(
  id: number,
  columns: string[]
): Promise<PortfolioDynamicResponse> {
  const { data } = await api.get<PortfolioDynamicResponse>(`/portfolios/${id}`, {
    params: { columns: columns.join(',') },
  })
  return data
}

export async function createPortfolio(payload: PortfolioCreate): Promise<PortfolioSummary> {
  const { data } = await api.post<PortfolioSummary>('/portfolios', payload)
  return data
}

export async function deletePortfolio(id: number): Promise<void> {
  await api.delete(`/portfolios/${id}`)
}

export async function savePortfolioColumns(id: number, columns: string[]): Promise<void> {
  await api.patch(`/portfolios/${id}/columns`, { columns })
}

export async function addHolding(portfolioId: number, payload: HoldingCreate): Promise<HoldingDetail> {
  const { data } = await api.post<HoldingDetail>(`/portfolios/${portfolioId}/holdings`, payload)
  return data
}

export async function deleteHolding(holdingId: number): Promise<void> {
  await api.delete(`/portfolios/holdings/${holdingId}`)
}

export async function importCsv(portfolioId: number, file: File): Promise<CsvImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<CsvImportResult>(`/portfolios/${portfolioId}/import`, formData)
  return data
}

export async function exportCsv(portfolioId: number): Promise<string> {
  const { data } = await api.get<string>(`/portfolios/${portfolioId}/export`)
  return data
}

export async function refreshPortfolio(
  portfolioId: number,
  columns?: string[]
): Promise<PortfolioDetailResponse | PortfolioDynamicResponse> {
  const params = columns ? { columns: columns.join(',') } : undefined
  const { data } = await api.post(`/portfolios/${portfolioId}/refresh`, null, { params })
  return data
}

// --- Earnings ---

export interface UpcomingEarning {
  symbol: string
  name: string | null
  date: string
  time: string | null
  eps_estimated: number | null
  revenue_estimated: number | null
}

export interface EarningsCalendarResponse {
  from_date: string
  to_date: string
  earnings: UpcomingEarning[]
}

export interface EarningsRecord {
  ticker: string
  fiscal_date: string
  fiscal_quarter: number | null
  fiscal_year: number | null
  eps_estimated: number | null
  eps_actual: number | null
  eps_surprise: number | null
  eps_surprise_pct: number | null
  revenue_estimated: number | null
  revenue_actual: number | null
  revenue_surprise_pct: number | null
  report_time: string | null
}

export interface EarningsAnalysis {
  ticker: string
  total_quarters: number
  eps_beats: number
  eps_misses: number
  eps_beat_rate: number | null
  avg_eps_surprise_pct: number | null
  revenue_beats: number
  revenue_misses: number
  revenue_beat_rate: number | null
}

export interface EarningsHistoryResponse {
  ticker: string
  earnings: EarningsRecord[]
  analysis: EarningsAnalysis | null
}

export async function getEarningsCalendar(params?: {
  from_date?: string
  to_date?: string
  tickers?: string
}): Promise<EarningsCalendarResponse> {
  const { data } = await api.get<EarningsCalendarResponse>('/earnings/calendar', { params })
  return data
}

export async function getEarningsHistory(ticker: string, limit = 12): Promise<EarningsHistoryResponse> {
  const { data } = await api.get<EarningsHistoryResponse>(`/earnings/${ticker}/history`, { params: { limit } })
  return data
}

// --- Chat ---

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data } = await api.get<ConversationSummary[]>('/chat/conversations')
  return data
}

export async function createConversation(title = 'New Conversation'): Promise<ConversationSummary> {
  const { data } = await api.post<ConversationSummary>('/chat/conversations', { title })
  return data
}

export async function getConversation(id: number): Promise<ConversationDetail> {
  const { data } = await api.get<ConversationDetail>(`/chat/conversations/${id}`)
  return data
}

export async function deleteConversation(id: number): Promise<void> {
  await api.delete(`/chat/conversations/${id}`)
}

export async function sendMessage(
  conversationId: number,
  content: string,
  onChunk: (text: string) => void,
  onCitations?: (citations: Citation[]) => void,
): Promise<void> {
  // Build headers with auth token if available
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (getAuthToken) {
    const token = await getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  })

  if (!response.ok) {
    throw new Error(`Chat error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          if (parsed && typeof parsed === 'object' && parsed.__citations) {
            onCitations?.(parsed.__citations)
          } else {
            onChunk(parsed)
          }
        } catch {
          onChunk(data)
        }
      }
    }
  }
}

// --- Screener ---

export interface ScreenerResult {
  symbol: string
  name: string | null
  market_cap: number | null
  sector: string | null
  industry: string | null
  price: number | null
  beta: number | null
  volume: number | null
  dividend: number | null
  exchange: string | null
  country: string | null
}

export interface ScreenerResponse {
  results: ScreenerResult[]
  offset: number
  limit: number
  count: number
}

export async function runScreener(params: {
  market_cap_min?: number
  market_cap_max?: number
  price_min?: number
  price_max?: number
  beta_min?: number
  beta_max?: number
  volume_min?: number
  dividend_min?: number
  sector?: string
  industry?: string
  exchange?: string
  country?: string
  limit?: number
  offset?: number
}): Promise<ScreenerResponse> {
  const { data } = await api.get<ScreenerResponse>('/screener', { params })
  return data
}

// --- Market Data ---

export interface SectorPerformance {
  sector: string
  etf: string
  changes_pct: number | null
  price: number | null
  change: number | null
}

export async function getSectorPerformance(): Promise<SectorPerformance[]> {
  const { data } = await api.get<{ sectors: SectorPerformance[] }>('/market/sectors')
  return data.sectors
}

export interface SectorHistoryPoint {
  date: string
  [etf: string]: string | number | null
}

export interface SectorHistoryResponse {
  series: SectorHistoryPoint[]
  etfs: { etf: string; sector: string }[]
}

export async function getSectorHistory(fromDate: string, toDate: string): Promise<SectorHistoryResponse> {
  const { data } = await api.get<SectorHistoryResponse>('/market/sectors/history', {
    params: { from_date: fromDate, to_date: toDate },
  })
  return data
}

export interface AnalystRating {
  symbol: string
  date: string | null
  action: string | null
  rating_from: string | null
  rating_to: string | null
  firm: string | null
}

export async function getAnalystRatings(params?: { symbols?: string }): Promise<AnalystRating[]> {
  const { data } = await api.get<{ ratings: AnalystRating[] }>('/market/analyst-ratings', { params })
  return data.ratings
}

export interface AnalystConsensus {
  strong_buy: number | null
  buy: number | null
  hold: number | null
  sell: number | null
  strong_sell: number | null
  consensus: string | null
  pt_high: number | null
  pt_low: number | null
  pt_consensus: number | null
  pt_median: number | null
}

export async function getAnalystConsensus(symbols?: string): Promise<Record<string, AnalystConsensus>> {
  const { data } = await api.get<{ consensus: Record<string, AnalystConsensus> }>('/market/analyst-consensus', {
    params: symbols ? { symbols } : undefined,
  })
  return data.consensus
}

export interface InsiderTrade {
  symbol: string
  filing_date: string | null
  transaction_date: string | null
  insider_name: string | null
  title: string | null
  transaction_type: string | null
  shares: number | null
  price: number | null
  value: number | null
}

export async function getInsiderTrades(params?: { limit?: number; transaction_type?: string }): Promise<InsiderTrade[]> {
  const { data } = await api.get<{ trades: InsiderTrade[] }>('/market/insider-trades', { params })
  return data.trades
}

// --- Stock News, Income Statement, Analyst Estimates ---

export interface StockNews {
  title: string
  published_date: string | null
  publisher: string | null
  site: string | null
  text: string | null
  url: string | null
  image: string | null
}

export interface IncomeStatement {
  date: string
  revenue: number | null
  gross_profit: number | null
  operating_income: number | null
  net_income: number | null
  eps: number | null
  ebitda: number | null
  gross_profit_ratio: number | null
  operating_income_ratio: number | null
  net_income_ratio: number | null
  ebitda_ratio: number | null
}

export interface AnalystEstimate {
  date: string
  revenue_avg: number | null
  revenue_low: number | null
  revenue_high: number | null
  eps_avg: number | null
  eps_low: number | null
  eps_high: number | null
  net_income_avg: number | null
  ebitda_avg: number | null
  num_analysts_revenue: number | null
  num_analysts_eps: number | null
}

export async function getStockNews(ticker: string): Promise<StockNews[]> {
  const { data } = await api.get<{ news: StockNews[] }>(`/stocks/${ticker}/news`)
  return data.news
}

export async function getIncomeStatement(ticker: string, period = 'annual'): Promise<IncomeStatement[]> {
  const { data } = await api.get<{ statements: IncomeStatement[] }>(`/stocks/${ticker}/income-statement`, { params: { period } })
  return data.statements
}

export async function getAnalystEstimates(ticker: string, period = 'annual'): Promise<AnalystEstimate[]> {
  const { data } = await api.get<{ estimates: AnalystEstimate[] }>(`/stocks/${ticker}/estimates`, { params: { period } })
  return data.estimates
}

export interface PricePoint {
  date: string
  price: number
}

export async function getStockPriceHistory(ticker: string, range = '1Y'): Promise<PricePoint[]> {
  const { data } = await api.get<PricePoint[]>(`/stocks/${ticker}/price-history`, { params: { range } })
  return data
}

export interface StockProfile {
  description: string | null
  website: string | null
  full_time_employees: number | null
  headquarters: string | null
}

export async function getStockProfile(ticker: string): Promise<StockProfile> {
  const { data } = await api.get<StockProfile>(`/stocks/${ticker}/profile`)
  return data
}

export async function getProvider(): Promise<LLMProviderInfo> {
  const { data } = await api.get<LLMProviderInfo>('/chat/provider')
  return data
}

export async function setProvider(provider: string, model?: string): Promise<LLMProviderInfo> {
  const { data } = await api.put<LLMProviderInfo>('/chat/provider', { provider, model })
  return data
}
