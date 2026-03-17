import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { runScreener } from '@/services/api'
import type { ScreenerResult } from '@/services/api'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Constants ───────────────────────────────────────────────────────────────

const MARKET_CAP_PRESETS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Mega', min: 200_000_000_000, max: undefined, hint: '>$200B' },
  { label: 'Large', min: 10_000_000_000, max: 200_000_000_000, hint: '$10B–$200B' },
  { label: 'Mid', min: 2_000_000_000, max: 10_000_000_000, hint: '$2B–$10B' },
  { label: 'Small', min: 300_000_000, max: 2_000_000_000, hint: '$300M–$2B' },
  { label: 'Micro', min: undefined, max: 300_000_000, hint: '<$300M' },
]

const SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Cyclical',
  'Consumer Defensive', 'Industrials', 'Energy', 'Materials',
  'Real Estate', 'Communication Services', 'Utilities',
]

const EXCHANGES = ['NYSE', 'NASDAQ', 'AMEX']

const VOLUME_PRESETS = [
  { label: 'Any', value: undefined },
  { label: '>100K', value: 100_000 },
  { label: '>500K', value: 500_000 },
  { label: '>1M', value: 1_000_000 },
  { label: '>10M', value: 10_000_000 },
]

const BETA_PRESETS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Low (<0.8)', min: undefined, max: 0.8 },
  { label: 'Medium (0.8–1.2)', min: 0.8, max: 1.2 },
  { label: 'High (>1.2)', min: 1.2, max: undefined },
]

type SortKey = keyof ScreenerResult
type SortDir = 'asc' | 'desc'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null, prefix = '', suffix = '', decimals = 2): string {
  if (v == null) return '—'
  return `${prefix}${v.toFixed(decimals)}${suffix}`
}

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

function PillGroup<T>({
  options, value, onChange, getLabel, getValue,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  getLabel: (v: T) => string
  getValue: (v: T) => unknown
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt, i) => {
        const active = getValue(opt) === getValue(value)
        return (
          <button
            key={i}
            onClick={() => onChange(opt)}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors whitespace-nowrap ${
              active
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {getLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}

function RangeInput({
  label, minVal, maxVal, onMinChange, onMaxChange, prefix = '', step = 1,
}: {
  label: string
  minVal: string
  maxVal: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
  prefix?: string
  step?: number
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
          <input
            type="number"
            placeholder="Min"
            value={minVal}
            step={step}
            onChange={e => onMinChange(e.target.value)}
            className={`w-full text-xs rounded-lg border border-border bg-background py-1.5 pr-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${prefix ? 'pl-5' : 'pl-2.5'}`}
          />
        </div>
        <span className="text-muted-foreground text-xs">–</span>
        <div className="relative flex-1">
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
          <input
            type="number"
            placeholder="Max"
            value={maxVal}
            step={step}
            onChange={e => onMaxChange(e.target.value)}
            className={`w-full text-xs rounded-lg border border-border bg-background py-1.5 pr-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${prefix ? 'pl-5' : 'pl-2.5'}`}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ScreenerPage() {
  // Filters
  const [capPreset, setCapPreset] = useState(0)
  const [sector, setSector] = useState('')
  const [exchanges, setExchanges] = useState<string[]>([])
  const [volumePreset, setVolumePreset] = useState(0)
  const [betaPreset, setBetaPreset] = useState(0)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [dividendMin, setDividendMin] = useState('')
  const [globalStocks, setGlobalStocks] = useState(false)

  // Table
  const [sortKey, setSortKey] = useState<SortKey>('market_cap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [offset, setOffset] = useState(0)
  const PAGE = 50

  const cap = MARKET_CAP_PRESETS[capPreset]
  const beta = BETA_PRESETS[betaPreset]
  const volMin = VOLUME_PRESETS[volumePreset].value

  const queryParams = {
    market_cap_min: cap.min,
    market_cap_max: cap.max,
    price_min: priceMin ? parseFloat(priceMin) : undefined,
    price_max: priceMax ? parseFloat(priceMax) : undefined,
    beta_min: beta.min,
    beta_max: beta.max,
    volume_min: volMin,
    dividend_min: dividendMin ? parseFloat(dividendMin) : undefined,
    sector: sector || undefined,
    exchange: exchanges.length === 1 ? exchanges[0] : undefined,
    country: globalStocks ? undefined : 'US',
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
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [data, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setOffset(0)
  }

  function resetFilters() {
    setCapPreset(0); setSector(''); setExchanges([])
    setVolumePreset(0); setBetaPreset(0)
    setPriceMin(''); setPriceMax(''); setDividendMin('')
    setGlobalStocks(false); setOffset(0)
  }

  function toggleExchange(ex: string) {
    setExchanges(prev => prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex])
    setOffset(0)
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k
      ? <span className="opacity-20 ml-1">↕</span>
      : <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>

  const COLS: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'symbol', label: 'Ticker' },
    { key: 'name', label: 'Company' },
    { key: 'sector', label: 'Sector' },
    { key: 'industry', label: 'Industry' },
    { key: 'exchange', label: 'Exch' },
    { key: 'market_cap', label: 'Mkt Cap', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'beta', label: 'Beta', align: 'right' },
    { key: 'volume', label: 'Volume', align: 'right' },
    { key: 'dividend', label: 'Div/Share', align: 'right' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Stock Screener</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Filter stocks by market cap, sector, valuation, and more</p>
        </div>
        <button
          onClick={resetFilters}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Reset filters
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-5">

        {/* Row 1: Market Cap + Sector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Market Cap</p>
            <PillGroup
              options={MARKET_CAP_PRESETS}
              value={MARKET_CAP_PRESETS[capPreset]}
              onChange={v => { setCapPreset(MARKET_CAP_PRESETS.indexOf(v)); setOffset(0) }}
              getLabel={v => 'hint' in v ? `${v.label}` : v.label}
              getValue={v => MARKET_CAP_PRESETS.indexOf(v)}
            />
            {'hint' in MARKET_CAP_PRESETS[capPreset] && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {(MARKET_CAP_PRESETS[capPreset] as typeof MARKET_CAP_PRESETS[1]).hint}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sector</p>
            <select
              value={sector}
              onChange={e => { setSector(e.target.value); setOffset(0) }}
              className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Sectors</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Exchange + Beta + Volume */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Exchange</p>
            <div className="flex flex-wrap gap-1.5">
              {EXCHANGES.map(ex => (
                <button
                  key={ex}
                  onClick={() => toggleExchange(ex)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    exchanges.includes(ex)
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Beta (Volatility)</p>
            <PillGroup
              options={BETA_PRESETS}
              value={BETA_PRESETS[betaPreset]}
              onChange={v => { setBetaPreset(BETA_PRESETS.indexOf(v)); setOffset(0) }}
              getLabel={v => v.label}
              getValue={v => BETA_PRESETS.indexOf(v)}
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Min Volume</p>
            <PillGroup
              options={VOLUME_PRESETS}
              value={VOLUME_PRESETS[volumePreset]}
              onChange={v => { setVolumePreset(VOLUME_PRESETS.indexOf(v)); setOffset(0) }}
              getLabel={v => v.label}
              getValue={v => VOLUME_PRESETS.indexOf(v)}
            />
          </div>
        </div>

        {/* Row 3: Price range + Dividend + Global */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <RangeInput
            label="Price Range"
            minVal={priceMin}
            maxVal={priceMax}
            onMinChange={v => { setPriceMin(v); setOffset(0) }}
            onMaxChange={v => { setPriceMax(v); setOffset(0) }}
            prefix="$"
            step={0.01}
          />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Min Annual Dividend</p>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <input
                type="number"
                placeholder="e.g. 0.50"
                value={dividendMin}
                step={0.01}
                min={0}
                onChange={e => { setDividendMin(e.target.value); setOffset(0) }}
                className="w-full text-xs rounded-lg border border-border bg-background pl-5 pr-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => { setGlobalStocks(v => !v); setOffset(0) }}
                className={`w-9 h-5 rounded-full transition-colors relative ${globalStocks ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${globalStocks ? 'left-4' : 'left-0.5'}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Global Stocks</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{globalStocks ? 'All countries' : 'US only'}</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Results</span>
          <span className="text-xs text-muted-foreground">
            {isFetching || isLoading ? 'Loading…' : data ? `${data.count} stocks` : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {COLS.map(col => (
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
              {isLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {COLS.map((_, j) => (
                        <td key={j} className="px-4 py-2.5"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : sorted.map((r: ScreenerResult) => (
                    <tr key={r.symbol} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Link to={`/research/stock/${r.symbol}`} className="font-mono font-bold text-primary hover:underline">
                          {r.symbol}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px] truncate text-sm">{r.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.sector ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">{r.industry ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.exchange ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatMarketCap(r.market_cap)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmt(r.price, '$')}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{fmt(r.beta, '', '', 2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{formatVolume(r.volume)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{fmt(r.dividend, '$')}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

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
              {offset + 1}–{offset + sorted.length} {data.count === PAGE ? '· max per page' : ''}
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
