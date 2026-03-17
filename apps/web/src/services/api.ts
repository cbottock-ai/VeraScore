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

export async function getProvider(): Promise<LLMProviderInfo> {
  const { data } = await api.get<LLMProviderInfo>('/chat/provider')
  return data
}

export async function setProvider(provider: string, model?: string): Promise<LLMProviderInfo> {
  const { data } = await api.put<LLMProviderInfo>('/chat/provider', { provider, model })
  return data
}
