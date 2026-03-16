import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { runScreener } from '@/services/api'
import type { ScreenerResult } from '@/services/api'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Constants ───────────────────────────────────────────────────────────────

const MARKET_CAP_PRESETS = [
  { label: 'All', min: undefined, max: undefined },
  { label: 'Mega (>$200B)', min: 200_000_000_000, max: undefined },
  { label: 'Large ($10B–$200B)', min: 10_000_000_000, max: 200_000_000_000 },
  { label: 'Mid ($2B–$10B)', min: 2_000_000_000, max: 10_000_000_000 },
  { label: 'Small ($300M–$2B)', min: 300_000_000, max: 2_000_000_000 },
  { label: 'Micro (<$300M)', min: undefined, max: 300_000_000 },
] as const

const SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Cyclical',
  'Consumer Defensive', 'Industrials', 'Energy', 'Materials',
  'Real Estate', 'Communication Services', 'Utilities',
]

const EXCHANGES = [
  { label: 'All', value: '' },
  { label: 'NYSE', value: 'NYSE' },
  { label: 'NASDAQ', value: 'NASDAQ' },
  { label: 'AMEX', value: 'AMEX' },
]

type SortKey = 'symbol' | 'name' | 'market_cap' | 'price' | 'volume' | 'sector'
type SortDir = 'asc' | 'desc'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMarketCap(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

function formatVolume(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v.toString()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ScreenerPage() {
  const [capPreset, setCapPreset] = useState(0)
  const [sector, setSector] = useState('')
  const [exchange, setExchange] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('market_cap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [offset, setOffset] = useState(0)
  const PAGE = 50

  const preset = MARKET_CAP_PRESETS[capPreset]

  const queryParams = {
    market_cap_min: preset.min,
    market_cap_max: preset.max,
    sector: sector || undefined,
    exchange: exchange || undefined,
    limit: PAGE,
    offset,
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['screener', queryParams],
    queryFn: () => runScreener(queryParams),
    staleTime: 5 * 60 * 1000,
  })

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data.results].sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
      const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [data, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function handleFilterChange() {
    setOffset(0)
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-muted-foreground/30 ml-1">↕</span>
    return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Stock Screener</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Filter stocks by market cap, sector, and exchange</p>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        {/* Market cap */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Market Cap</p>
          <div className="flex flex-wrap gap-1.5">
            {MARKET_CAP_PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => { setCapPreset(i); handleFilterChange() }}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  capPreset === i
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Sector */}
          <div className="flex-1 min-w-[160px]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sector</p>
            <select
              value={sector}
              onChange={e => { setSector(e.target.value); handleFilterChange() }}
              className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Sectors</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Exchange */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Exchange</p>
            <div className="flex gap-1.5">
              {EXCHANGES.map(ex => (
                <button
                  key={ex.value}
                  onClick={() => { setExchange(ex.value); handleFilterChange() }}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    exchange === ex.value
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Results
          </span>
          {data && (
            <span className="text-xs text-muted-foreground">
              {isFetching ? 'Loading…' : `${data.count} stocks · page ${Math.floor(offset / PAGE) + 1}`}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {(
                  [
                    { key: 'symbol', label: 'Ticker', align: 'left' },
                    { key: 'name', label: 'Company', align: 'left' },
                    { key: 'sector', label: 'Sector', align: 'left' },
                    { key: 'exchange', label: 'Exch', align: 'left' },
                    { key: 'market_cap', label: 'Mkt Cap', align: 'right' },
                    { key: 'price', label: 'Price', align: 'right' },
                    { key: 'volume', label: 'Volume', align: 'right' },
                  ] as { key: SortKey; label: string; align: string }[]
                ).map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-foreground select-none ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {col.label}<SortIcon k={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-2.5">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.map((r: ScreenerResult) => (
                <tr key={r.symbol} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link
                      to={`/research/stock/${r.symbol}`}
                      className="font-mono font-bold text-primary hover:underline text-sm"
                    >
                      {r.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-sm max-w-[220px] truncate">{r.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.sector ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.exchange ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">{formatMarketCap(r.market_cap)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">{r.price != null ? `$${r.price.toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-muted-foreground">{formatVolume(r.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setOffset(o => Math.max(0, o - PAGE))}
              disabled={offset === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-border font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + PAGE, offset + data.count)} of {data.count} {data.count === PAGE ? '(max per page)' : ''}
            </span>
            <button
              onClick={() => setOffset(o => o + PAGE)}
              disabled={data.count < PAGE}
              className="text-xs px-3 py-1.5 rounded-lg border border-border font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
