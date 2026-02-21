import axios from 'axios'
import type { StockSearchResponse, StockDetail, FundamentalsResponse, StockScoresResponse } from '@/types/stock'

const api = axios.create({
  baseURL: '/api',
})

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
