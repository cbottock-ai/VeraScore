import { useQuery } from '@tanstack/react-query'
import { getMarketIndices, getQuotes, listPortfolios, getPortfolio } from '@/services/api'
import type { MarketIndex, StockQuote } from '@/services/api'

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA']

function IndexCard({ index }: { index: MarketIndex }) {
  const isPositive = (index.change ?? 0) >= 0
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500'
  const arrow = isPositive ? '▲' : '▼'

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="text-sm text-muted-foreground mb-1">{index.name} - {index.symbol}</div>
      <div className="text-2xl font-semibold mb-1">
        {index.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
      </div>
      <div className={`text-sm font-medium ${changeColor}`}>
        {arrow} {Math.abs(index.change ?? 0).toFixed(2)} ({Math.abs(index.changePercent ?? 0).toFixed(2)}%)
      </div>
    </div>
  )
}

function MoversRow({ quote }: { quote: StockQuote }) {
  const isPositive = (quote.change ?? 0) >= 0
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500'

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
      <div className="font-medium">{quote.symbol}</div>
      <div className="text-right">
        <div className="font-medium">
          ${quote.price?.toFixed(2) ?? '—'}
        </div>
        <div className={`text-sm ${changeColor}`}>
          {isPositive ? '+' : ''}{quote.changePercent?.toFixed(2) ?? '0.00'}%
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: indices, isLoading: indicesLoading } = useQuery({
    queryKey: ['marketIndices'],
    queryFn: getMarketIndices,
    refetchInterval: 60000,
  })

  // Get portfolios to check for watchlist holdings
  const { data: portfoliosData } = useQuery({
    queryKey: ['portfolios'],
    queryFn: listPortfolios,
  })

  // Get first portfolio details if exists
  const firstPortfolioId = portfoliosData?.portfolios?.[0]?.id
  const { data: portfolioDetail } = useQuery({
    queryKey: ['portfolio', firstPortfolioId],
    queryFn: () => getPortfolio(firstPortfolioId!),
    enabled: !!firstPortfolioId,
  })

  // Get tickers from watchlist or use popular stocks
  const watchlistTickers = portfolioDetail?.holdings?.map(h => h.ticker) ?? []
  const tickersToFetch = watchlistTickers.length > 0 ? watchlistTickers : POPULAR_TICKERS

  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes', tickersToFetch],
    queryFn: () => getQuotes(tickersToFetch),
    refetchInterval: 60000,
  })

  // Sort alphabetically by symbol
  const sortedQuotes = [...(quotes ?? [])].sort(
    (a, b) => (a.symbol ?? '').localeCompare(b.symbol ?? '')
  )

  const hasWatchlist = watchlistTickers.length > 0

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Welcome to VeraScore</h1>
      <p className="text-muted-foreground mb-6">Your intelligent stock research companion</p>

      {/* Market Indices - Top */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-4 text-muted-foreground">Market Overview</h2>
        {indicesLoading ? (
          <div className="text-muted-foreground">Loading market data...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {indices?.map((index) => (
              <IndexCard key={index.symbol} index={index} />
            ))}
          </div>
        )}
      </section>

      {/* Content area with stocks on right */}
      <div className="flex justify-end">
        <section className="w-full max-w-sm">
          <h2 className="text-lg font-medium mb-4 text-muted-foreground">
            {hasWatchlist ? 'Watchlist Movers' : 'Most Popular'}
          </h2>
          <div className="bg-card rounded-lg p-4 border border-border">
            {quotesLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : sortedQuotes.length === 0 ? (
              <div className="text-muted-foreground">No data available</div>
            ) : (
              sortedQuotes.slice(0, 7).map((quote) => (
                <MoversRow key={quote.symbol} quote={quote} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
