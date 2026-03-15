import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  sendMessage,
  getProvider,
  setProvider,
} from '@/services/api'
import type { Citation, ConversationSummary, Message } from '@/types/chat'

export function ChatPage() {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<number | null>(null)
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() =>
    localStorage.getItem('disclaimer-dismissed') === 'true'
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [_pendingCitations, setPendingCitations] = useState<Citation[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Conversations list
  const convsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
  })

  // Provider info
  const providerQuery = useQuery({
    queryKey: ['provider'],
    queryFn: getProvider,
  })

  // Load conversation messages when activeId changes
  useEffect(() => {
    if (activeId) {
      getConversation(activeId).then((conv) => {
        setMessages(conv.messages)
      })
    } else {
      setMessages([])
    }
  }, [activeId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Create conversation
  const createMutation = useMutation({
    mutationFn: () => createConversation(),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setActiveId(conv.id)
    },
  })

  // Delete conversation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setActiveId(null)
      setMessages([])
    },
  })

  // Switch provider
  const providerMutation = useMutation({
    mutationFn: (provider: string) => setProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider'] })
    },
  })

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming) return

    let convId = activeId

    // Auto-create conversation if none selected
    if (!convId) {
      const conv = await createConversation()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      convId = conv.id
      setActiveId(conv.id)
    }

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setStreaming(true)
    setStreamingText('')
    setPendingCitations([])

    try {
      let accumulated = ''
      let citations: Citation[] = []
      await sendMessage(
        convId,
        userMessage.content,
        (chunk) => {
          accumulated += chunk
          setStreamingText(accumulated)
        },
        (c) => {
          citations = c
        },
      )

      if (accumulated) {
        const assistantMessage: Message = {
          id: Date.now() + 1,
          role: 'assistant',
          content: accumulated,
          created_at: new Date().toISOString(),
          citations: citations.length > 0 ? citations : undefined,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }

      // Refresh conversation list for title updates
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err) {
      console.error('Send message error:', err)
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setStreaming(false)
      setStreamingText('')
    }
  }, [input, streaming, activeId, queryClient])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const conversations = convsQuery.data || []
  const provider = providerQuery.data

  const handleDismissDisclaimer = () => {
    localStorage.setItem('disclaimer-dismissed', 'true')
    setDisclaimerDismissed(true)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-88px)] -my-6 -mx-4">
      {/* First-visit disclaimer banner */}
      {!disclaimerDismissed && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 shrink-0">
          <span>
            <strong>Disclaimer:</strong> VeraScore provides research tools, not financial advice.
            Always consult a qualified financial advisor before making investment decisions.
          </span>
          <button
            onClick={handleDismissDisclaimer}
            className="shrink-0 text-amber-600 hover:text-amber-900 dark:hover:text-amber-100 font-bold"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-muted/30">
        <div className="p-3 border-b border-border">
          <button
            onClick={() => createMutation.mutate()}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv: ConversationSummary) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer text-sm border-b border-border/50 transition-colors ${
                conv.id === activeId
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => setActiveId(conv.id)}
            >
              <span className="flex-1 truncate">{conv.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteMutation.mutate(conv.id)
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs transition-opacity"
                title="Delete"
              >
                &times;
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              No conversations yet
            </p>
          )}
        </div>

        {/* Provider toggle */}
        {provider && provider.available_providers.length > 0 && (
          <div className="p-3 border-t border-border">
            <label className="text-xs text-muted-foreground block mb-1">Provider</label>
            <select
              value={provider.provider}
              onChange={(e) => providerMutation.mutate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              {provider.available_providers.map((p) => (
                <option key={p} value={p}>
                  {p === 'anthropic' ? 'Claude' : p === 'openai' ? 'GPT-4o' : p}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1 truncate">{provider.model}</p>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <h2 className="text-xl font-semibold mb-2">VeraScore Chat</h2>
                <p className="text-sm">
                  Ask about stocks, scores, fundamentals, or manage your portfolios.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {streaming && streamingText && (
            <MessageBubble
              message={{
                id: -1,
                role: 'assistant',
                content: streamingText,
                created_at: '',
              }}
            />
          )}

          {streaming && !streamingText && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0">
                VS
              </div>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about stocks, scores, or portfolios..."
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={1}
              disabled={streaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            VeraScore provides research tools, not financial advice. Always consult a qualified financial advisor before making investment decisions.
          </p>
        </div>
      </div>
    </div>
    </div>
  )
}

const CITATION_ICONS: Record<string, string> = {
  web: '🌐',
  rag: '📄',
  earnings: '📊',
  fundamentals: '📈',
  score: '⭐',
  data: '💹',
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
        }`}
      >
        {isUser ? 'You' : 'VS'}
      </div>
      <div className="max-w-[70%] flex flex-col gap-1">
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            isUser
              ? 'bg-primary text-primary-foreground whitespace-pre-wrap'
              : 'bg-muted prose prose-sm prose-neutral dark:prose-invert max-w-none'
          }`}
        >
          {isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.citations.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 bg-background hover:bg-muted transition-colors"
                  >
                    {CITATION_ICONS[c.tool] ?? '📌'} {c.label}
                  </a>
                ) : (
                  <span className="text-[11px] text-muted-foreground border border-border rounded px-2 py-0.5 bg-background">
                    {CITATION_ICONS[c.tool] ?? '📌'} {c.label}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
