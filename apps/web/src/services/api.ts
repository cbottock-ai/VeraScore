import axios from 'axios'
import type { StockSearchResponse, StockDetail, FundamentalsResponse, StockScoresResponse } from '@/types/stock'
import type {
  PortfolioListResponse,
  PortfolioSummary,
  PortfolioDetailResponse,
  PortfolioCreate,
  HoldingDetail,
  HoldingCreate,
  CsvImportResult,
} from '@/types/portfolio'

const api = axios.create({
  baseURL: '/api',
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

// --- Portfolios ---

export async function listPortfolios(): Promise<PortfolioListResponse> {
  const { data } = await api.get<PortfolioListResponse>('/portfolios')
  return data
}

export async function getPortfolio(id: number): Promise<PortfolioDetailResponse> {
  const { data } = await api.get<PortfolioDetailResponse>(`/portfolios/${id}`)
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
