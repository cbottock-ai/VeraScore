export interface ConversationSummary {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface Citation {
  tool: string
  label: string
  url?: string
}

export interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
  citations?: Citation[]
}

export interface ConversationDetail {
  id: number
  title: string
  messages: Message[]
}

export interface LLMProviderInfo {
  provider: string
  model: string
  available_providers: string[]
}
