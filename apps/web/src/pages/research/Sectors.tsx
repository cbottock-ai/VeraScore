import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { getSectorPerformance, getSectorHistory } from '@/services/api'
import type { SectorPerformance, SectorHistoryResponse } from '@/services/api'

const SECTOR_ICONS: Record<string, string> = {
  Technology: '💻',
  Healthcare: '🏥',
  Financials: '🏦',
  'Consumer Discretionary': '🛍️',
  'Consumer Staples': '🛒',
  Industrials: '🏭',
  Energy: '⚡',
  Utilities: '💡',
  'Real Estate': '🏠',
  Materials: '⛏️',
  'Communication Services': '📡',
}

// Distinct colors for each sector ETF
const ETF_COLORS: Record<string, string> = {
  XLK: '#6366f1',
  XLV: '#10b981',
  XLF: '#f59e0b',
  XLY: '#ef4444',
  XLP: '#8b5cf6',
  XLI: '#3b82f6',
  XLE: '#f97316',
  XLU: '#06b6d4',
  XLRE: '#ec4899',
  XLB: '#84cc16',
  XLC: '#14b8a6',
}

type RangeKey = '5d' | '1m' | '3m' | '6m' | 'ytd' | '1y' | 'custom'

const RANGE_LABELS: Record<RangeKey, string> = {
  '5d': '5D',
  '1m': '1M',
  '3m': '3M',
  '6m': '6M',
  ytd: 'YTD',
  '1y': '1Y',
  custom: 'Custom',
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeFromKey(key: RangeKey): { from: string; to: string } {
  const today = new Date()
  const to = toISO(today)
  switch (key) {
    case '5d': {
      const d = new Date(today)
      d.setDate(d.getDate() - 7) // include weekends buffer
      return { from: toISO(d), to }
    }
    case '1m': {
      const d = new Date(today)
      d.setMonth(d.getMonth() - 1)
      return { from: toISO(d), to }
    }
    case '3m': {
      const d = new Date(today)
      d.setMonth(d.getMonth() - 3)
      return { from: toISO(d), to }
    }
    case '6m': {
      const d = new Date(today)
      d.setMonth(d.getMonth() - 6)
      return { from: toISO(d), to }
    }
    case 'ytd':
      return { from: `${today.getFullYear()}-01-01`, to }
    case '1y': {
      const d = new Date(today)
      d.setFullYear(d.getFullYear() - 1)
      return { from: toISO(d), to }
    }
    default:
      return { from: toISO(today), to }
  }
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
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function fmtAxisDate(dateStr: string, range: RangeKey): string {
  const d = new Date(dateStr)
  if (range === '5d') return d.toLocaleDateString('en-US', { weekday: 'short' })
  if (range === '1m' || range === '3m')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// Thin out x-axis ticks so they don't crowd
function tickIndices(len: number, max = 8): number[] {
  if (len <= max) return Array.from({ length: len }, (_, i) => i)
  const step = Math.ceil(len / max)
  const idxs: number[] = []
  for (let i = 0; i < len; i += step) idxs.push(i)
  if (idxs[idxs.length - 1] !== len - 1) idxs.push(len - 1)
  return idxs
}

export function SectorsPage() {
  const [activeRange, setActiveRange] = useState<RangeKey>('ytd')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [hiddenEtfs, setHiddenEtfs] = useState<Set<string>>(new Set())

  const { from, to } = useMemo(() => {
    if (activeRange === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo }
    }
    if (activeRange === 'custom') return { from: '', to: '' }
    return rangeFromKey(activeRange)
  }, [activeRange, customFrom, customTo])

  const { data: sectors = [], isLoading: sectorsLoading } = useQuery<SectorPerformance[]>({
    queryKey: ['sectorPerformance'],
    queryFn: getSectorPerformance,
    staleTime: 5 * 60 * 1000,
  })

  const { data: history, isLoading: histLoading } = useQuery<SectorHistoryResponse>({
    queryKey: ['sectorHistory', from, to],
    queryFn: () => getSectorHistory(from, to),
    enabled: !!(from && to),
    staleTime: 10 * 60 * 1000,
  })

  const sorted = [...sectors].sort((a, b) => (b.changes_pct ?? -Infinity) - (a.changes_pct ?? -Infinity))

  // For 5d: keep last 5 trading days
  const chartSeries = useMemo(() => {
    if (!history?.series) return []
    const s = history.series
    if (activeRange === '5d') return s.slice(-5)
    return s
  }, [history, activeRange])

  const ticks = useMemo(() => {
    if (!chartSeries.length) return []
    const idxs = tickIndices(chartSeries.length)
    return idxs.map((i) => chartSeries[i]?.date).filter(Boolean)
  }, [chartSeries])

  const etfs = history?.etfs ?? []

  function toggleEtf(etf: string) {
    setHiddenEtfs((prev) => {
      const next = new Set(prev)
      if (next.has(etf)) next.delete(etf)
      else next.add(etf)
      return next
    })
  }

  // Last return value per ETF for legend labels
  const lastReturns = useMemo(() => {
    const last = chartSeries[chartSeries.length - 1]
    if (!last) return {}
    const out: Record<string, number | null> = {}
    for (const { etf } of etfs) {
      const v = last[etf]
      out[etf] = typeof v === 'number' ? v : null
    }
    return out
  }, [chartSeries, etfs])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sectors</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Performance across all 11 GICS sectors via SPDR ETFs</p>
      </div>

      {/* Today's heatmap */}
      {sectorsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
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
      )}

      {/* Historical performance */}
      <div className="rounded-xl border border-border p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Historical Performance</h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Range toggles */}
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setActiveRange(k)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeRange === k
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {RANGE_LABELS[k]}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            {activeRange === 'custom' && (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border border-border rounded px-2 py-1 bg-background text-xs"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border border-border rounded px-2 py-1 bg-background text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* ETF legend / toggles */}
        {etfs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {etfs
              .slice()
              .sort((a, b) => (lastReturns[b.etf] ?? -Infinity) - (lastReturns[a.etf] ?? -Infinity))
              .map(({ etf, sector }) => {
                const hidden = hiddenEtfs.has(etf)
                const ret = lastReturns[etf]
                return (
                  <button
                    key={etf}
                    onClick={() => toggleEtf(etf)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-opacity ${
                      hidden ? 'opacity-30' : 'opacity-100'
                    } border-border hover:border-foreground/30`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ETF_COLORS[etf] ?? '#888' }}
                    />
                    <span className="font-medium">{etf}</span>
                    <span className="text-muted-foreground hidden sm:inline">{sector}</span>
                    {ret != null && (
                      <span className={`font-semibold tabular-nums ${ret >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmt(ret)}
                      </span>
                    )}
                  </button>
                )
              })}
          </div>
        )}

        {/* Chart */}
        {histLoading && (
          <div className="h-72 rounded-lg bg-muted animate-pulse" />
        )}

        {!histLoading && chartSeries.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={(v) => fmtAxisDate(v, activeRange)}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
              <Tooltip
                formatter={(value: unknown, name: unknown) => {
                  const v = value as number
                  const n = name as string
                  return [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, etfs.find((e) => e.etf === n)?.sector ?? n]
                }}
                labelFormatter={(label) =>
                  new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                }
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              {etfs.map(({ etf }) => (
                <Line
                  key={etf}
                  type="monotone"
                  dataKey={etf}
                  stroke={ETF_COLORS[etf] ?? '#888'}
                  strokeWidth={hiddenEtfs.has(etf) ? 0 : 1.5}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {!histLoading && !from && activeRange === 'custom' && (
          <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
            Select a date range above to load historical data.
          </div>
        )}
      </div>
    </div>
  )
}
