import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalystRatings } from '@/services/api'
import type { AnalystRating } from '@/services/api'

type ActionFilter = 'all' | 'upgrade' | 'downgrade' | 'initiated' | 'reiterated'

const ACTION_LABELS: Record<ActionFilter, string> = {
  all: 'All',
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  initiated: 'Initiated',
  reiterated: 'Reiterated',
}

function actionBadge(action: string | null) {
  const a = (action ?? '').toLowerCase()
  if (a.includes('upgrade')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
  if (a.includes('downgrade')) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  if (a.includes('initiat')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
  return 'bg-muted text-muted-foreground'
}

function actionLabel(action: string | null): string {
  if (!action) return '—'
  const a = action.toLowerCase()
  if (a.includes('upgrade')) return 'Upgrade'
  if (a.includes('downgrade')) return 'Downgrade'
  if (a.includes('initiat')) return 'Initiated'
  if (a.includes('reiterat') || a.includes('maintain')) return 'Reiterated'
  return action
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s.slice(0, 10)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPT(val: number | null): string {
  if (val === null) return '—'
  return `$${val.toFixed(2)}`
}

export function AnalystRatingsPage() {
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [search, setSearch] = useState('')

  const { data: ratings = [], isLoading, isError } = useQuery<AnalystRating[]>({
    queryKey: ['analystRatings'],
    queryFn: () => getAnalystRatings(200),
    staleTime: 10 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    let rows = ratings
    if (actionFilter !== 'all') {
      rows = rows.filter((r) => actionLabel(r.action).toLowerCase() === actionFilter)
    }
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      rows = rows.filter(
        (r) =>
          r.symbol?.toUpperCase().includes(q) ||
          r.name?.toUpperCase().includes(q) ||
          r.firm?.toUpperCase().includes(q),
      )
    }
    return rows
  }, [ratings, actionFilter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ratings.length, upgrade: 0, downgrade: 0, initiated: 0, reiterated: 0 }
    for (const r of ratings) {
      const a = actionLabel(r.action).toLowerCase() as ActionFilter
      if (c[a] !== undefined) c[a]++
    }
    return c
  }, [ratings])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Analyst Ratings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Recent upgrades, downgrades, and price target changes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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
              {counts[k] > 0 && (
                <span className="ml-1 opacity-60">{counts[k]}</span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search ticker, company, or firm…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring w-64"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          Unable to load analyst ratings. This may require a premium FMP plan.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ticker</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Rating Change</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Price Target</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Firm</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No ratings match your filters.
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(r.published_date)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    <a
                      href={`/research/stock/${r.symbol}`}
                      className="hover:text-primary transition-colors"
                    >
                      {r.symbol}
                    </a>
                    {r.name && (
                      <div className="text-xs text-muted-foreground font-normal truncate max-w-36">{r.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${actionBadge(r.action)}`}>
                      {actionLabel(r.action)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.rating_from && r.rating_to ? (
                      <span>
                        <span className="opacity-60">{r.rating_from}</span>
                        <span className="mx-1">→</span>
                        <span className="font-medium text-foreground">{r.rating_to}</span>
                      </span>
                    ) : (
                      r.rating_to ?? r.rating_from ?? '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {r.price_target_from && r.price_target ? (
                      <span>
                        <span className="opacity-60">{fmtPT(r.price_target_from)}</span>
                        <span className="mx-1 opacity-40">→</span>
                        <span className={r.price_target > (r.price_target_from ?? 0) ? 'text-emerald-600' : 'text-red-500'}>
                          {fmtPT(r.price_target)}
                        </span>
                      </span>
                    ) : (
                      fmtPT(r.price_target)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.firm ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
