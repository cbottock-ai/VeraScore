import { useQuery } from '@tanstack/react-query'
import { getSectorPerformance } from '@/services/api'
import type { SectorPerformance } from '@/services/api'

const SECTOR_ICONS: Record<string, string> = {
  'Technology': '💻',
  'Healthcare': '🏥',
  'Financials': '🏦',
  'Consumer Discretionary': '🛍️',
  'Consumer Staples': '🛒',
  'Industrials': '🏭',
  'Energy': '⚡',
  'Utilities': '💡',
  'Real Estate': '🏠',
  'Materials': '⛏️',
  'Communication Services': '📡',
}

function tileColor(pct: number | null): string {
  if (pct === null) return 'bg-muted text-muted-foreground'
  if (pct >= 2) return 'bg-emerald-600 text-white'
  if (pct >= 1) return 'bg-emerald-500 text-white'
  if (pct >= 0.25) return 'bg-emerald-400 text-white'
  if (pct >= 0) return 'bg-emerald-200 text-emerald-900'
  if (pct >= -0.25) return 'bg-red-200 text-red-900'
  if (pct >= -1) return 'bg-red-400 text-white'
  if (pct >= -2) return 'bg-red-500 text-white'
  return 'bg-red-600 text-white'
}

function fmt(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function SectorsPage() {
  const { data: sectors = [], isLoading, isError } = useQuery<SectorPerformance[]>({
    queryKey: ['sectorPerformance'],
    queryFn: getSectorPerformance,
    staleTime: 5 * 60 * 1000,
  })

  const sorted = [...sectors].sort((a, b) => (b.changes_pct ?? -Infinity) - (a.changes_pct ?? -Infinity))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sectors</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Today's performance across all 11 GICS sectors</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          Unable to load sector data. This may require a premium FMP plan.
        </div>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          No sector data available.
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <>
          {/* Heatmap grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {sorted.map((s) => (
              <div
                key={s.sector}
                className={`rounded-xl p-4 flex flex-col justify-between min-h-24 transition-opacity hover:opacity-90 ${tileColor(s.changes_pct)}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{SECTOR_ICONS[s.sector] ?? '📊'}</span>
                  <span className="text-xs opacity-60 font-mono">{s.etf}</span>
                </div>
                <div>
                  <div className="text-xs font-medium opacity-80 leading-tight">{s.sector}</div>
                  <div className="text-2xl font-bold tabular-nums mt-0.5">{fmt(s.changes_pct)}</div>
                  {s.price != null && (
                    <div className="text-xs opacity-60 tabular-nums">${s.price.toFixed(2)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="rounded-xl border border-border p-4 space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Relative Performance</h2>
            {sorted.map((s) => {
              const pct = s.changes_pct ?? 0
              const maxAbs = Math.max(...sorted.map((x) => Math.abs(x.changes_pct ?? 0)), 1)
              const barWidth = Math.abs(pct / maxAbs) * 100
              const positive = pct >= 0
              return (
                <div key={s.sector} className="flex items-center gap-3 text-sm">
                  <div className="w-44 shrink-0 text-right text-xs text-muted-foreground truncate">{s.sector}</div>
                  <div className="flex-1 flex items-center gap-1 h-5">
                    {positive ? (
                      <>
                        <div className="w-1/2 flex justify-end">
                          <div className="h-3 rounded-sm bg-muted" style={{ width: '100%' }} />
                        </div>
                        <div className="w-1/2 flex">
                          <div
                            className="h-3 rounded-sm bg-emerald-500"
                            style={{ width: `${barWidth * 50}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-1/2 flex justify-end">
                          <div
                            className="h-3 rounded-sm bg-red-500"
                            style={{ width: `${barWidth * 50}%` }}
                          />
                        </div>
                        <div className="w-1/2 flex">
                          <div className="h-3 rounded-sm bg-muted" style={{ width: '100%' }} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className={`w-16 text-xs tabular-nums font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt(s.changes_pct)}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
