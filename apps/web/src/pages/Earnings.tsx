import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEarningsCalendar, listPortfolios, getPortfolio } from '@/services/api'
import { Skeleton } from '@/components/ui/skeleton'

const NOTABLE_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT', 'UNH']

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function EarningsPage() {
  const { data: portfoliosData } = useQuery({
    queryKey: ['portfolios'],
    queryFn: listPortfolios,
    staleTime: 5 * 60 * 1000,
  })
  const firstPortfolioId = portfoliosData?.portfolios?.[0]?.id
  const { data: portfolioDetail } = useQuery({
    queryKey: ['portfolio', firstPortfolioId],
    queryFn: () => getPortfolio(firstPortfolioId!),
    enabled: !!firstPortfolioId,
    staleTime: 5 * 60 * 1000,
  })
  const watchlistTickers = portfolioDetail?.holdings?.map(h => h.ticker) ?? []
  const watchlistSet = new Set(watchlistTickers)

  const combined = Array.from(new Set([...watchlistTickers, ...NOTABLE_TICKERS]))
  const tickers = combined.join(',')

  const { data, isLoading } = useQuery({
    queryKey: ['earningsCalendar', tickers],
    queryFn: () => getEarningsCalendar({ tickers }),
    staleTime: 5 * 60 * 1000,
  })

  const earnings = data?.earnings ?? []

  // Group by date
  const byDate = earnings.reduce<Record<string, typeof earnings>>((acc, e) => {
    acc[e.date] = acc[e.date] ?? []
    acc[e.date].push(e)
    return acc
  }, {})
  const sortedDates = Object.keys(byDate).sort()

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Earnings Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Major releases + your watchlist · Next 14 days</p>
        </div>
        {!isLoading && (
          <span className="text-sm text-muted-foreground">{earnings.length} reports</span>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No major earnings in the next 14 days
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <div key={date} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {formatDate(date)}
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {byDate[date].map((e, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/research/stock/${e.symbol}`}
                            className="font-semibold text-sm font-mono text-primary hover:underline"
                          >
                            {e.symbol}
                          </Link>
                          {watchlistSet.has(e.symbol) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                              Watchlist
                            </span>
                          )}
                          {e.time && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                              {e.time === 'bmo' ? 'Pre-mkt' : e.time === 'amc' ? 'After-mkt' : e.time}
                            </span>
                          )}
                        </div>
                        {e.name && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">{e.name}</div>
                        )}
                      </div>
                    </div>
                    {e.eps_estimated !== null && (
                      <div className="text-xs text-muted-foreground">
                        Est. EPS <span className="font-mono text-foreground font-medium">${e.eps_estimated.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
