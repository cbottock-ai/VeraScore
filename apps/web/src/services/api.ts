import axios from 'axios'
import type { StockSearchResponse, StockDetail, FundamentalsResponse } from '@/types/stock'

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
