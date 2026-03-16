import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMarketIndices, getQuotes, listPortfolios, getPortfolio } from '@/services/api'
import { Skeleton } from '@/components/ui/skeleton'
import type { MarketIndex, StockQuote } from '@/services/api'

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA']

function IndexCard({ index }: { index: MarketIndex }) {
  const isPositive = (index.change ?? 0) >= 0
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500'
  const bgColor = isPositive ? 'bg-green-500/5' : 'bg-red-500/5'

  return (
    <div className={`rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80 ${bgColor}`}>
      <div className="text-xs text-muted-foreground mb-2 font-medium">{index.name}</div>
      <div className="text-2xl font-semibold font-mono tabular-nums mb-1">
        {index.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
      </div>
      <div className={`text-sm font-medium flex items-center gap-1 ${changeColor}`}>
        <span>{isPositive ? '▲' : '▼'}</span>
        <span>{Math.abs(index.change ?? 0).toFixed(2)}</span>
        <span className="text-xs opacity-80">({Math.abs(index.changePercent ?? 0).toFixed(2)}%)</span>
      </div>
    </div>
  )
}

function MoversRow({ quote, onClick }: { quote: StockQuote; onClick: () => void }) {
  const isPositive = (quote.changePercent ?? 0) >= 0
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-2.5 px-1 rounded-lg hover:bg-muted/40 transition-colors group text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground font-mono">
            {(quote.symbol ?? '').slice(0, 2)}
          </span>
        </div>
        <div>
          <div className="font-medium text-sm group-hover:text-primary transition-colors">{quote.symbol}</div>
          <div className="text-xs text-muted-foreground">{quote.name ?? ''}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono font-medium text-sm tabular-nums">
          ${quote.price?.toFixed(2) ?? '—'}
        </div>
        <div className={`text-xs font-medium ${changeColor}`}>
          {isPositive ? '+' : ''}{quote.changePercent?.toFixed(2) ?? '0.00'}%
        </div>
      </div>
    </button>
  )
}

function IndexCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}

function MoversRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-2.5 px-1">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-1">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="text-right space-y-1">
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()

  const { data: indices, isLoading: indicesLoading } = useQuery({
    queryKey: ['marketIndices'],
    queryFn: getMarketIndices,
    refetchInterval: 60000,
  })

  const { data: portfoliosData } = useQuery({
    queryKey: ['portfolios'],
    queryFn: listPortfolios,
  })

  const firstPortfolioId = portfoliosData?.portfolios?.[0]?.id
  const { data: portfolioDetail } = useQuery({
    queryKey: ['portfolio', firstPortfolioId],
    queryFn: () => getPortfolio(firstPortfolioId!),
    enabled: !!firstPortfolioId,
  })

  const watchlistTickers = portfolioDetail?.holdings?.map(h => h.ticker) ?? []
  const tickersToFetch = watchlistTickers.length > 0 ? watchlistTickers : POPULAR_TICKERS

  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes', tickersToFetch],
    queryFn: () => getQuotes(tickersToFetch),
    refetchInterval: 60000,
  })

  const sortedQuotes = [...(quotes ?? [])].sort((a, b) =>
    Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0)
  )

  const hasWatchlist = watchlistTickers.length > 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Market overview and your watchlist</p>
      </div>

      {/* Market Indices */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Market Overview</h2>
        {indicesLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <IndexCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {indices?.map((index) => (
              <IndexCard key={index.symbol} index={index} />
            ))}
          </div>
        )}
      </section>

      {/* Watchlist / Movers */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {hasWatchlist ? 'Watchlist' : 'Most Active'}
          </h2>
          {!hasWatchlist && (
            <button
              onClick={() => navigate('/watchlist')}
              className="text-xs text-primary hover:underline"
            >
              Add to watchlist →
            </button>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-1">
          {quotesLoading ? (
            Array.from({ length: 7 }).map((_, i) => <MoversRowSkeleton key={i} />)
          ) : sortedQuotes.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No data available</p>
          ) : (
            sortedQuotes.slice(0, 8).map((quote) => (
              <MoversRow
                key={quote.symbol}
                quote={quote}
                onClick={() => navigate(`/research/stock/${quote.symbol}`)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}
