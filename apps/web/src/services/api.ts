import axios from 'axios'
import type { StockSearchResponse, StockDetail, FundamentalsResponse, StockScoresResponse } from '@/types/stock'
import type { ConversationSummary, ConversationDetail, LLMProviderInfo } from '@/types/chat'
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
): Promise<void> {
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
          onChunk(JSON.parse(data))
        } catch {
          onChunk(data)
        }
      }
    }
  }
}

export async function getProvider(): Promise<LLMProviderInfo> {
  const { data } = await api.get<LLMProviderInfo>('/chat/provider')
  return data
}

export async function setProvider(provider: string, model?: string): Promise<LLMProviderInfo> {
  const { data } = await api.put<LLMProviderInfo>('/chat/provider', { provider, model })
  return data
}
