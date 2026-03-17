import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalystRatings, listPortfolios, getPortfolio } from '@/services/api'
import type { AnalystRating } from '@/services/api'

type ActionFilter = 'all' | 'upgrade' | 'downgrade' | 'initiated' | 'reiterated'

const ACTION_LABELS: Record<ActionFilter, string> = {
  all: 'All',
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  initiated: 'Initiated',
  reiterated: 'Reiterated',
}

function normalizeAction(action: string | null): ActionFilter {
  const a = (action ?? '').toLowerCase()
  if (a === 'upgrade') return 'upgrade'
  if (a === 'downgrade') return 'downgrade'
  if (a === 'init' || a === 'initiated' || a.includes('initiat')) return 'initiated'
  if (a === 'maintain' || a === 'reiterat' || a.includes('reiterat') || a.includes('maintain')) return 'reiterated'
  return 'reiterated'
}

function actionLabel(action: string | null): string {
  return ACTION_LABELS[normalizeAction(action)] ?? (action ?? '—')
}

function actionBadgeCls(action: string | null): string {
  switch (normalizeAction(action)) {
    case 'upgrade': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    case 'downgrade': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    case 'initiated': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s.slice(0, 10)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AnalystRatingsPage() {
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [watchlistOnly, setWatchlistOnly] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Load watchlist tickers
  const { data: portfoliosData } = useQuery({ queryKey: ['portfolios'], queryFn: listPortfolios })
  const firstPortfolioId = portfoliosData?.portfolios?.[0]?.id
  const { data: portfolioDetail } = useQuery({
    queryKey: ['portfolio', firstPortfolioId],
    queryFn: () => getPortfolio(firstPortfolioId!),
    enabled: !!firstPortfolioId,
  })
  const watchlistTickers = useMemo(
    () => portfolioDetail?.holdings?.map((h) => h.ticker) ?? [],
    [portfolioDetail],
  )

  // Fetch ratings — when watchlistOnly, pass the watchlist symbols; otherwise use defaults
  const symbolsParam = watchlistOnly && watchlistTickers.length > 0
    ? watchlistTickers.join(',')
    : undefined

  const { data: ratings = [], isLoading, isError } = useQuery<AnalystRating[]>({
    queryKey: ['analystRatings', symbolsParam],
    queryFn: () => getAnalystRatings({ symbols: symbolsParam, limit: 15 }),
    staleTime: 10 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    let rows = ratings
    if (actionFilter !== 'all') {
      rows = rows.filter((r) => normalizeAction(r.action) === actionFilter)
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toUpperCase()
      rows = rows.filter(
        (r) => r.symbol?.toUpperCase().includes(q) || r.firm?.toUpperCase().includes(q),
      )
    }
    return rows
  }, [ratings, actionFilter, debouncedSearch])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ratings.length, upgrade: 0, downgrade: 0, initiated: 0, reiterated: 0 }
    for (const r of ratings) {
      const a = normalizeAction(r.action)
      c[a] = (c[a] ?? 0) + 1
    }
    return c
  }, [ratings])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Analyst Ratings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Recent upgrades, downgrades, and initiations from Wall Street analysts</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Action type pills */}
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(Object.keys(ACTION_LABELS) as ActionFilter[]).map((k) => (
            <button
              key={k}
              onClick={() => setActionFilter(k)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                actionFilter === k
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {ACTION_LABELS[k]}
              {counts[k] > 0 && <span className="ml-1 opacity-50">{counts[k]}</span>}
            </button>
          ))}
        </div>

        {/* Watchlist toggle */}
        <button
          onClick={() => setWatchlistOnly((v) => !v)}
          disabled={watchlistTickers.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            watchlistOnly
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          Watchlist
          {watchlistTickers.length > 0 && (
            <span className="opacity-60">{watchlistTickers.length}</span>
          )}
        </button>

        {/* Search */}
        <input
          type="text"
          placeholder="Search ticker or firm…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring w-52"
        />
      </div>

      {/* Source note */}
      <p className="text-xs text-muted-foreground -mt-1">
        {watchlistOnly
          ? `Showing grades for your ${watchlistTickers.length} watchlist stocks.`
          : 'Showing grades for 50 large-cap stocks. Toggle Watchlist to filter to your holdings.'}
      </p>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Unable to load analyst ratings.
        </div>
      )}

      {watchlistOnly && watchlistTickers.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Add stocks to your watchlist to filter ratings.
        </div>
      )}

      {!isLoading && !isError && ratings.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ticker</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Rating Change</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Firm</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    No ratings match your filters.
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3 font-semibold">
                    <a href={`/research/stock/${r.symbol}`} className="hover:text-primary transition-colors">
                      {r.symbol}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${actionBadgeCls(r.action)}`}>
                      {actionLabel(r.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.rating_from && r.rating_to && r.rating_from !== r.rating_to ? (
                      <span>
                        <span className="text-muted-foreground">{r.rating_from}</span>
                        <span className="mx-1.5 text-muted-foreground">→</span>
                        <span className="font-medium">{r.rating_to}</span>
                      </span>
                    ) : (
                      <span className="font-medium">{r.rating_to ?? r.rating_from ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.firm ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
