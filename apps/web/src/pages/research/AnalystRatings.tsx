import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalystRatings, getAnalystConsensus, listPortfolios, getPortfolio } from '@/services/api'
import type { AnalystRating, AnalystConsensus } from '@/services/api'

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
  if (a === 'init' || a.includes('initiat')) return 'initiated'
  return 'reiterated'
}

function actionBadgeCls(action: string | null): string {
  switch (normalizeAction(action)) {
    case 'upgrade': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    case 'downgrade': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    case 'initiated': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function consensusBadgeCls(c: string | null): string {
  const s = (c ?? '').toLowerCase()
  if (s.includes('strong buy')) return 'bg-emerald-600 text-white'
  if (s === 'buy') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
  if (s === 'hold' || s === 'neutral') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
  if (s.includes('strong sell')) return 'bg-red-600 text-white'
  if (s === 'sell') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  return 'bg-muted text-muted-foreground'
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPT(n: number | null): string {
  return n != null ? `$${n.toFixed(0)}` : '—'
}

function logoUrl(symbol: string): string {
  return `https://financialmodelingprep.com/image-stock/${symbol}.png`
}

function TickerLogo({ symbol }: { symbol: string }) {
  const [err, setErr] = useState(false)
  const hue = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  if (err) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: `hsl(${hue},55%,45%)` }}
      >
        {symbol[0]}
      </span>
    )
  }
  return (
    <img
      src={logoUrl(symbol)}
      alt={symbol}
      width={24} height={24}
      className="rounded object-contain shrink-0"
      onError={() => setErr(true)}
    />
  )
}

function ConsensusMini({ c }: { c: AnalystConsensus }) {
  const total = (c.strong_buy ?? 0) + (c.buy ?? 0) + (c.hold ?? 0) + (c.sell ?? 0) + (c.strong_sell ?? 0)
  if (!total) return <span className="text-muted-foreground">—</span>
  const bullish = ((c.strong_buy ?? 0) + (c.buy ?? 0)) / total
  const bearish = ((c.sell ?? 0) + (c.strong_sell ?? 0)) / total
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${consensusBadgeCls(c.consensus)}`}>
        {c.consensus ?? '—'}
      </span>
      <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-muted">
        <div className="bg-emerald-500 h-full" style={{ width: `${bullish * 100}%` }} />
        <div className="bg-red-500 h-full" style={{ width: `${bearish * 100}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
    </div>
  )
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

  // Watchlist
  const { data: portfoliosData } = useQuery({ queryKey: ['portfolios'], queryFn: listPortfolios })
  const firstPortfolioId = portfoliosData?.portfolios?.[0]?.id
  const { data: portfolioDetail } = useQuery({
    queryKey: ['portfolio', firstPortfolioId],
    queryFn: () => getPortfolio(firstPortfolioId!),
    enabled: !!firstPortfolioId,
  })
  const watchlistTickers = useMemo(() => portfolioDetail?.holdings?.map(h => h.ticker) ?? [], [portfolioDetail])

  const symbolsParam = watchlistOnly && watchlistTickers.length > 0 ? watchlistTickers.join(',') : undefined

  const { data: ratings = [], isLoading, isError } = useQuery<AnalystRating[]>({
    queryKey: ['analystRatings', symbolsParam],
    queryFn: () => getAnalystRatings({ symbols: symbolsParam }),
    staleTime: 10 * 60 * 1000,
  })

  // Consensus — fetch for unique symbols in current filtered set (up to 50 at a time)
  const uniqueSymbols = useMemo(() => [...new Set(ratings.map(r => r.symbol))], [ratings])
  const { data: consensusMap = {} } = useQuery({
    queryKey: ['analystConsensus', uniqueSymbols.slice(0, 100).join(',')],
    queryFn: () => getAnalystConsensus(uniqueSymbols.join(',')),
    enabled: uniqueSymbols.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    let rows = ratings
    if (actionFilter !== 'all') rows = rows.filter(r => normalizeAction(r.action) === actionFilter)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toUpperCase()
      rows = rows.filter(r => r.symbol?.toUpperCase().includes(q) || r.firm?.toUpperCase().includes(q))
    }
    return rows
  }, [ratings, actionFilter, debouncedSearch])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ratings.length, upgrade: 0, downgrade: 0, initiated: 0, reiterated: 0 }
    for (const r of ratings) c[normalizeAction(r.action)] = (c[normalizeAction(r.action)] ?? 0) + 1
    return c
  }, [ratings])

  // Summary stats
  const summary = useMemo(() => ({
    upgrades: counts.upgrade,
    downgrades: counts.downgrade,
    initiated: counts.initiated,
    total: ratings.length,
  }), [counts, ratings.length])

  const bullPct = summary.total > 0 ? ((summary.upgrades + summary.initiated) / summary.total) * 100 : 0
  const bearPct = summary.total > 0 ? (summary.downgrades / summary.total) * 100 : 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Analyst Ratings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Recent upgrades, downgrades, and initiations — last 60 days</p>
      </div>

      {/* Summary bar */}
      {!isLoading && ratings.length > 0 && (
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Sentiment ({summary.total} ratings)</span>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-600 font-semibold">▲ {summary.upgrades + summary.initiated} Bullish</span>
              <span className="text-muted-foreground">{counts.reiterated} Reiterated</span>
              <span className="text-red-500 font-semibold">▼ {summary.downgrades} Bearish</span>
            </div>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted gap-px">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${bullPct}%` }} />
            <div className="bg-red-500 h-full transition-all" style={{ width: `${bearPct}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(Object.keys(ACTION_LABELS) as ActionFilter[]).map(k => (
            <button
              key={k}
              onClick={() => setActionFilter(k)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                actionFilter === k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {ACTION_LABELS[k]}
              {counts[k] > 0 && <span className="ml-1 opacity-50">{counts[k]}</span>}
            </button>
          ))}
        </div>

        <button
          onClick={() => setWatchlistOnly(v => !v)}
          disabled={watchlistTickers.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
            watchlistOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          Watchlist {watchlistTickers.length > 0 && <span className="opacity-60">{watchlistTickers.length}</span>}
        </button>

        <input
          type="text"
          placeholder="Search ticker or firm…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring w-52"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-11 rounded-lg bg-muted animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Unable to load analyst ratings.
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
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Consensus</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Price Target</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No ratings match your filters.</td></tr>
              )}
              {filtered.map((r, i) => {
                const c = consensusMap[r.symbol]
                return (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3">
                      <a href={`/research/stock/${r.symbol}`} className="flex items-center gap-2 hover:text-primary transition-colors w-fit">
                        <TickerLogo symbol={r.symbol} />
                        <span className="font-semibold">{r.symbol}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${actionBadgeCls(r.action)}`}>
                        {ACTION_LABELS[normalizeAction(r.action)]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      {c ? <ConsensusMini c={c} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      {c?.pt_consensus != null ? (
                        <div>
                          <div className="font-medium">{fmtPT(c.pt_consensus)}</div>
                          <div className="text-muted-foreground">{fmtPT(c.pt_low)} – {fmtPT(c.pt_high)}</div>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
