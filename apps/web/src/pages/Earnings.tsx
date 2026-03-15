import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEarningsCalendar, getEarningsHistory, listPortfolios, getPortfolio } from '@/services/api'
import type { EarningsRecord } from '@/services/api'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCompact(value: number | null): string {
  if (value === null || value === undefined) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

function BeatBadge({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-muted-foreground">—</span>
  const beat = pct > 0
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${beat ? 'text-green-500' : 'text-red-500'}`}>
      {beat ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function ReportTimeBadge({ time }: { time: string | null }) {
  if (!time) return null
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
      {time === 'bmo' ? 'Pre-mkt' : time === 'amc' ? 'After-mkt' : time}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-semibold font-mono">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Upcoming Calendar ───────────────────────────────────────────────────────

function UpcomingCalendar({ watchlistTickers }: { watchlistTickers: string[] }) {
  const tickers = watchlistTickers.length > 0 ? watchlistTickers.join(',') : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['earningsCalendar', tickers],
    queryFn: () => getEarningsCalendar({ tickers }),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-40" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-border/50 last:border-0">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }

  const earnings = data?.earnings ?? []

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Upcoming · Next 14 Days
        </span>
        <span className="text-xs text-muted-foreground">{earnings.length} reports</span>
      </div>

      {earnings.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {watchlistTickers.length > 0
            ? 'No earnings from your watchlist in the next 14 days'
            : 'No upcoming earnings found'}
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {earnings.map((e, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/research/${e.symbol}`} className="font-semibold text-sm text-primary hover:underline font-mono">
                      {e.symbol}
                    </Link>
                    <ReportTimeBadge time={e.time} />
                  </div>
                  {e.name && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{e.name}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{formatDate(e.date)}</div>
                {e.eps_estimated !== null && (
                  <div className="text-xs text-muted-foreground">Est. EPS: ${e.eps_estimated.toFixed(2)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Earnings History ────────────────────────────────────────────────────────

function HistoryRow({ record }: { record: EarningsRecord }) {
  const quarter = record.fiscal_quarter ? `Q${record.fiscal_quarter}` : ''
  const year = record.fiscal_year ?? ''

  return (
    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 font-mono text-sm tabular-nums">{formatDate(record.fiscal_date)}</td>
      <td className="px-4 py-3 text-sm font-medium">{quarter} {year}</td>
      <td className="px-4 py-3 font-mono text-sm tabular-nums text-right">
        {record.eps_estimated !== null ? `$${record.eps_estimated.toFixed(2)}` : '—'}
      </td>
      <td className="px-4 py-3 font-mono text-sm tabular-nums text-right">
        {record.eps_actual !== null ? `$${record.eps_actual.toFixed(2)}` : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <BeatBadge pct={record.eps_surprise_pct} />
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums text-right text-muted-foreground">
        {formatCompact(record.revenue_estimated)}
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums text-right text-muted-foreground">
        {formatCompact(record.revenue_actual)}
      </td>
      <td className="px-4 py-3 text-right">
        <BeatBadge pct={record.revenue_surprise_pct} />
      </td>
    </tr>
  )
}

function EarningsHistory({ ticker }: { ticker: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['earningsHistory', ticker],
    queryFn: () => getEarningsHistory(ticker.toUpperCase()),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  if (!data || data.earnings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No earnings history found for {ticker.toUpperCase()}
      </div>
    )
  }

  const { analysis } = data

  return (
    <div className="space-y-4">
      {/* Analysis stats */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="EPS Beat Rate"
            value={analysis.eps_beat_rate !== null ? `${analysis.eps_beat_rate.toFixed(0)}%` : '—'}
            sub={`${analysis.eps_beats}B / ${analysis.eps_misses}M`}
          />
          <StatCard
            label="Rev Beat Rate"
            value={analysis.revenue_beat_rate !== null ? `${analysis.revenue_beat_rate.toFixed(0)}%` : '—'}
            sub={`${analysis.revenue_beats}B / ${analysis.revenue_misses}M`}
          />
          <StatCard
            label="Avg EPS Surprise"
            value={analysis.avg_eps_surprise_pct !== null ? `${analysis.avg_eps_surprise_pct > 0 ? '+' : ''}${analysis.avg_eps_surprise_pct.toFixed(1)}%` : '—'}
          />
          <StatCard
            label="Quarters Tracked"
            value={`${analysis.total_quarters}`}
          />
        </div>
      )}

      {/* History table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">EPS Est</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">EPS Actual</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Surprise</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rev Est</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rev Actual</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Surprise</th>
              </tr>
            </thead>
            <tbody>
              {data.earnings.map((record, i) => (
                <HistoryRow key={i} record={record} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function EarningsPage() {
  const [searchTicker, setSearchTicker] = useState('')
  const [activeTicker, setActiveTicker] = useState('')

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchTicker.trim()) setActiveTicker(searchTicker.trim().toUpperCase())
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">Earnings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upcoming calendar and historical results</p>
      </div>

      {/* Upcoming calendar */}
      <UpcomingCalendar watchlistTickers={watchlistTickers} />

      {/* Ticker history lookup */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Earnings History</h2>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchTicker}
            onChange={e => setSearchTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g. AAPL)"
            className="flex-1 max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Look up
          </button>
          {/* Quick picks from watchlist */}
          {watchlistTickers.slice(0, 5).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setSearchTicker(t); setActiveTicker(t) }}
              className={`px-3 py-2 rounded-lg border text-xs font-mono font-medium transition-colors ${
                activeTicker === t
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </form>

        {activeTicker ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Link to={`/research/${activeTicker}`} className="text-sm font-semibold text-primary hover:underline font-mono">
                {activeTicker}
              </Link>
              <span className="text-muted-foreground text-sm">Earnings History</span>
            </div>
            <EarningsHistory ticker={activeTicker} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Enter a ticker above or pick from your watchlist to view earnings history
          </div>
        )}
      </div>
    </div>
  )
}
