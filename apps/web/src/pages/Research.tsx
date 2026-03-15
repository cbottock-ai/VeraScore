import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStock, getFundamentals, getScores, getEarningsCalendar, getEarningsHistory, listPortfolios, getPortfolio } from '@/services/api'
import type { EarningsRecord, UpcomingEarning } from '@/services/api'
import { SP500_TICKERS } from '@/data/sp500'
import { MetricCard } from '@/components/MetricCard'
import { ScoreGauge, FactorBar, FactorCard } from '@/components/ScoreCard'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'


// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}


function BeatBadge({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-muted-foreground font-mono text-xs">—</span>
  const beat = pct > 0
  return (
    <span className={`font-mono text-xs font-semibold ${beat ? 'text-green-500' : 'text-red-500'}`}>
      {beat ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ─── Ticker Logo ─────────────────────────────────────────────────────────────

function TickerLogo({ symbol, size = 'md' }: { symbol: string; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false)
  const initials = symbol.slice(0, 2)
  const hue = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  const cls = size === 'sm' ? 'w-5 h-5 rounded' : 'w-7 h-7 rounded-md'

  if (failed) {
    return (
      <div
        className={`${cls} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
        style={{ backgroundColor: `hsl(${hue} 55% 45%)` }}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
      alt={symbol}
      className={`${cls} object-contain bg-white shrink-0`}
      onError={() => setFailed(true)}
    />
  )
}

// Small logo for monthly calendar cells (14px, no fallback text — just colored dot)
function CalendarLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false)
  const hue = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  if (failed) {
    return <div className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: `hsl(${hue} 55% 45%)` }} />
  }
  return (
    <img
      src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
      alt=""
      className="w-3.5 h-3.5 rounded-sm object-contain bg-white shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

// ─── Earnings Calendar helpers ───────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().split('T')[0] }

function currentWeekBounds() {
  const today = new Date()
  const dow = today.getDay() // 0=Sun, 6=Sat
  const mon = new Date(today)
  if (dow === 0) mon.setDate(today.getDate() + 1)        // Sun → next Mon
  else if (dow === 6) mon.setDate(today.getDate() + 2)   // Sat → next Mon
  else mon.setDate(today.getDate() - (dow - 1))          // weekday → this Mon
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  return { from: toISO(mon), to: toISO(fri) }
}

function getMonthBounds(d: Date) {
  return {
    from: toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  }
}

function getMonthWeeks(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const firstDow = first.getDay()
  const cur = new Date(first)
  cur.setDate(first.getDate() - (firstDow === 0 ? 6 : firstDow - 1))
  const weeks: Array<Array<{ date: string; day: number; inMonth: boolean }>> = []
  while (cur <= last) {
    const week = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(cur)
      d.setDate(cur.getDate() + i)
      week.push({ date: toISO(d), day: d.getDate(), inMonth: d.getMonth() === month && d.getFullYear() === year })
    }
    weeks.push(week)
    cur.setDate(cur.getDate() + 7)
  }
  return weeks
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

// ─── Upcoming Earnings Calendar ──────────────────────────────────────────────

function UpcomingEarningsCalendar({ watchlistTickers }: { watchlistTickers: string[] }) {
  const [watchlistOnly, setWatchlistOnly] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  const watchlistSet = useMemo(() => new Set(watchlistTickers), [watchlistTickers])
  const todayStr = useMemo(() => toISO(new Date()), [])
  const { from: weekFrom, to: weekTo } = useMemo(() => currentWeekBounds(), [])
  const { from: monthFrom, to: monthTo } = useMemo(() => getMonthBounds(viewMonth), [viewMonth])

  const weekQuery = useQuery({
    queryKey: ['earningsCalendar', weekFrom, weekTo],
    queryFn: () => getEarningsCalendar({ from_date: weekFrom, to_date: weekTo }),
    staleTime: 5 * 60 * 1000,
  })
  const monthQuery = useQuery({
    queryKey: ['earningsCalendar', monthFrom, monthTo],
    queryFn: () => getEarningsCalendar({ from_date: monthFrom, to_date: monthTo }),
    staleTime: 5 * 60 * 1000,
  })

  function filterAndGroup(earnings: UpcomingEarning[]) {
    const relevant = earnings.filter(e => SP500_TICKERS.has(e.symbol) || watchlistSet.has(e.symbol))
    const filtered = watchlistOnly ? relevant.filter(e => watchlistSet.has(e.symbol)) : relevant
    const byDate: Record<string, UpcomingEarning[]> = {}
    for (const e of filtered) {
      byDate[e.date] = byDate[e.date] ?? []
      byDate[e.date].push(e)
    }
    for (const date of Object.keys(byDate)) {
      byDate[date].sort((a, b) => {
        const aW = watchlistSet.has(a.symbol) ? 0 : 1
        const bW = watchlistSet.has(b.symbol) ? 0 : 1
        return aW - bW || a.symbol.localeCompare(b.symbol)
      })
    }
    return byDate
  }

  const weekByDate = useMemo(() => filterAndGroup(weekQuery.data?.earnings ?? []), [weekQuery.data, watchlistOnly, watchlistSet])
  const monthByDate = useMemo(() => filterAndGroup(monthQuery.data?.earnings ?? []), [monthQuery.data, watchlistOnly, watchlistSet])

  // Always show all 5 weekdays regardless of whether they have earnings
  const weekDates = useMemo(() => {
    const dates: string[] = []
    const start = new Date(weekFrom + 'T00:00:00')
    for (let i = 0; i < 5; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      dates.push(toISO(d))
    }
    return dates
  }, [weekFrom])
  const monthWeeks = useMemo(() => getMonthWeeks(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth])
  const monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekReportCount = weekDates.reduce((n, d) => n + (weekByDate[d]?.length ?? 0), 0)

  const WatchlistToggle = (
    <button
      onClick={() => setWatchlistOnly(v => !v)}
      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
        watchlistOnly ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      Watchlist only
    </button>
  )

  return (
    <div className="space-y-8">

      {/* ── This Week ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">This Week</h2>
            <p className="text-xs text-muted-foreground mt-0.5">S&P 500 · {weekFrom} – {weekTo}</p>
          </div>
          <div className="flex items-center gap-3">
            {!weekQuery.isLoading && <span className="text-xs text-muted-foreground">{weekReportCount} reports</span>}
            {WatchlistToggle}
          </div>
        </div>

        {weekQuery.isLoading ? (
          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 min-w-36 rounded-xl border border-border bg-card p-3 space-y-2">
                <Skeleton className="h-4 w-16 mx-auto" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-3/4 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3">
            {weekDates.map(date => {
              const { weekday, date: dateLabel } = dayLabel(date)
              const items = weekByDate[date] ?? []
              const isPast = date < todayStr
              return (
                <div key={date} className={`flex-1 min-w-36 rounded-xl border bg-card overflow-hidden transition-opacity ${isPast ? 'opacity-50' : ''} ${date === todayStr ? 'border-primary/40' : 'border-border'}`}>
                  <div className={`px-3 py-2.5 border-b text-center ${date === todayStr ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border'}`}>
                    <div className="text-xs font-bold text-foreground uppercase tracking-wide">{weekday}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{dateLabel}</div>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {items.length === 0 ? (
                      <div className="py-6 text-center text-[11px] text-muted-foreground/40">—</div>
                    ) : items.map((e, i) => {
                      const isWL = watchlistSet.has(e.symbol)
                      return (
                        <Link
                          key={i}
                          to={`/research/${e.symbol}`}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                            isWL ? 'bg-primary/10 border border-primary/30 hover:bg-primary/15' : 'bg-muted/50 border border-transparent hover:bg-muted'
                          }`}
                        >
                          <TickerLogo symbol={e.symbol} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold font-mono leading-none ${isWL ? 'text-primary' : 'text-foreground'}`}>{e.symbol}</span>
                              {e.time && (
                                <span className="text-[9px] text-muted-foreground font-medium leading-none shrink-0">
                                  {e.time === 'bmo' ? '▲pre' : e.time === 'amc' ? '▼post' : e.time}
                                </span>
                              )}
                            </div>
                            {e.name && <div className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">{e.name}</div>}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Monthly Calendar ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">{monthName}</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >‹</button>
            <button
              onClick={() => setViewMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="px-2.5 h-7 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
            >Today</button>
            <button
              onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >›</button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-5 border-b border-border bg-muted/30">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border/50 last:border-0">
                {d}
              </div>
            ))}
          </div>

          {monthQuery.isLoading ? (
            <div className="grid grid-cols-5 divide-x divide-border/50">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="p-2 min-h-[88px] border-b border-border/40">
                  <Skeleton className="h-4 w-5 mb-2 rounded-full" />
                  <Skeleton className="h-4 w-full rounded mb-1" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div>
              {monthWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-5 border-b border-border/40 last:border-0">
                  {week.map(({ date, day, inMonth }) => {
                    const items = monthByDate[date] ?? []
                    const isToday = date === todayStr
                    const VISIBLE = 3
                    return (
                      <div
                        key={date}
                        className={`p-2 min-h-[88px] border-r border-border/40 last:border-0 ${!inMonth ? 'bg-muted/15' : ''}`}
                      >
                        <span className={`text-xs font-semibold inline-flex items-center justify-center w-5 h-5 rounded-full ${
                          isToday ? 'bg-primary text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground/30'
                        }`}>
                          {day}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {items.slice(0, VISIBLE).map((e, i) => {
                            const isWL = watchlistSet.has(e.symbol)
                            return (
                              <Link
                                key={i}
                                to={`/research/${e.symbol}`}
                                className={`flex items-center gap-1 rounded py-0.5 px-1 transition-colors ${
                                  isWL ? 'bg-primary/15 hover:bg-primary/25' : 'bg-muted hover:bg-muted/80'
                                }`}
                              >
                                <CalendarLogo symbol={e.symbol} />
                                <span className={`text-[10px] font-mono font-bold truncate ${isWL ? 'text-primary' : 'text-foreground/70'}`}>
                                  {e.symbol}
                                </span>
                              </Link>
                            )
                          })}
                          {items.length > VISIBLE && (
                            <span className="text-[10px] text-muted-foreground px-1 leading-none">+{items.length - VISIBLE}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ─── Earnings History (on stock page) ───────────────────────────────────────

function EarningsHistorySection({ ticker }: { ticker: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['earningsHistory', ticker],
    queryFn: () => getEarningsHistory(ticker),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  if (!data || data.earnings.length === 0) return null

  const { analysis } = data

  return (
    <div className="space-y-4">
      {/* Analysis stats */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'EPS Beat Rate', value: analysis.eps_beat_rate !== null ? `${analysis.eps_beat_rate.toFixed(0)}%` : '—', sub: `${analysis.eps_beats}B · ${analysis.eps_misses}M` },
            { label: 'Rev Beat Rate', value: analysis.revenue_beat_rate !== null ? `${analysis.revenue_beat_rate.toFixed(0)}%` : '—', sub: `${analysis.revenue_beats}B · ${analysis.revenue_misses}M` },
            { label: 'Avg EPS Surprise', value: analysis.avg_eps_surprise_pct !== null ? `${analysis.avg_eps_surprise_pct > 0 ? '+' : ''}${analysis.avg_eps_surprise_pct.toFixed(1)}%` : '—' },
            { label: 'Quarters Tracked', value: `${analysis.total_quarters}` },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className="text-xl font-semibold font-mono">{s.value}</div>
              {s.sub && <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* History table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Period', 'EPS Est', 'EPS Actual', 'Surprise', 'Rev Est', 'Rev Actual', 'Surprise'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-right first:text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.earnings as EarningsRecord[]).map((r, i) => {
                const period = r.fiscal_quarter ? `Q${r.fiscal_quarter} ${r.fiscal_year ?? ''}` : r.fiscal_date
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{period}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums">{r.eps_estimated !== null ? `$${r.eps_estimated.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums">{r.eps_actual !== null ? `$${r.eps_actual.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right"><BeatBadge pct={r.eps_surprise_pct} /></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-right tabular-nums text-muted-foreground">{r.revenue_estimated ? formatCompact(r.revenue_estimated) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-right tabular-nums text-muted-foreground">{r.revenue_actual ? formatCompact(r.revenue_actual) : '—'}</td>
                    <td className="px-4 py-2.5 text-right"><BeatBadge pct={r.revenue_surprise_pct} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ResearchPage() {
  const { ticker } = useParams()

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

  const stockQuery = useQuery({
    queryKey: ['stock', ticker],
    queryFn: () => getStock(ticker!),
    enabled: !!ticker,
  })

  const scoresQuery = useQuery({
    queryKey: ['scores', ticker],
    queryFn: () => getScores(ticker!),
    enabled: !!ticker,
  })

  const fundamentalsQuery = useQuery({
    queryKey: ['fundamentals', ticker],
    queryFn: () => getFundamentals(ticker!),
    enabled: !!ticker,
  })

  // ── No ticker selected: show earnings calendar ───────────────────────────
  if (!ticker) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Research</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Search a ticker in the header to view scores and analysis</p>
        </div>
        <UpcomingEarningsCalendar watchlistTickers={watchlistTickers} />
      </div>
    )
  }

  const stock = stockQuery.data
  const scores = scoresQuery.data
  const fundamentals = fundamentalsQuery.data

  return (
    <div className="space-y-6">
      {/* ── Stock Header ──────────────────────────────────────────────────── */}
      {stockQuery.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-9 w-36" />
        </div>
      ) : stock ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-xl font-semibold">{stock.name}</h1>
                <Badge variant="secondary" className="font-mono text-xs">{stock.ticker}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {stock.sector && <span>{stock.sector}</span>}
                {stock.sector && stock.industry && <span className="text-border">·</span>}
                {stock.industry && <span>{stock.industry}</span>}
                {stock.exchange && <><span className="text-border">·</span><span>{stock.exchange}</span></>}
              </div>
            </div>
            {stock.price !== null && (
              <div className="text-right">
                <div className="text-3xl font-semibold font-mono tabular-nums">${stock.price.toFixed(2)}</div>
                {stock.change_percent !== null && (
                  <span className={`text-sm font-medium ${stock.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stock.change_percent >= 0 ? '▲' : '▼'} {Math.abs(stock.change_percent).toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
          {stock.price !== null && (
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {stock.market_cap !== null && <span>Market Cap <span className="text-foreground font-medium">{formatCompact(stock.market_cap)}</span></span>}
              {stock.beta !== null && <span>Beta <span className="text-foreground font-medium">{stock.beta.toFixed(2)}</span></span>}
              {stock.week_52_high !== null && stock.week_52_low !== null && (
                <span>52W Range <span className="text-foreground font-medium">${stock.week_52_low.toFixed(2)} – ${stock.week_52_high.toFixed(2)}</span></span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-muted-foreground">Stock not found.</p>
        </div>
      )}

      {/* ── VeraScore Hero ────────────────────────────────────────────────── */}
      {scoresQuery.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-5"><Skeleton className="h-40 w-full" /></div>
      ) : scores ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">VeraScore</h2>
          <div className="flex items-center gap-8 flex-wrap">
            <ScoreGauge score={scores.overall_score} label="Overall Score" size="lg" />
            <div className="flex-1 min-w-[220px] divide-y divide-border/50">
              {Object.values(scores.factors).map((f) => (
                <FactorBar key={f.factor} factor={f} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Score Breakdown ───────────────────────────────────────────────── */}
      {scores && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Score Breakdown</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Object.values(scores.factors).map((f) => (
              <FactorCard key={f.factor} factor={f} />
            ))}
          </div>
        </div>
      )}

      {/* ── Earnings History ──────────────────────────────────────────────── */}
      {ticker && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Earnings History</h2>
          <EarningsHistorySection ticker={ticker} />
        </div>
      )}

      {/* ── Fundamentals ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Fundamentals</h2>
        {fundamentalsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : fundamentals ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <MetricCard title="Valuation" metrics={[
              { label: 'P/E (TTM)', value: fundamentals.valuation.pe_ttm, format: 'ratio' },
              { label: 'P/E (NTM)', value: fundamentals.valuation.pe_ntm, format: 'ratio' },
              { label: 'EPS (TTM)', value: fundamentals.valuation.eps_ttm, format: 'currency' },
              { label: 'EPS (NTM)', value: fundamentals.valuation.eps_ntm, format: 'currency' },
              { label: 'P/B', value: fundamentals.valuation.pb_ratio, format: 'ratio' },
              { label: 'P/S (TTM)', value: fundamentals.valuation.ps_ttm, format: 'ratio' },
              { label: 'EV/EBITDA', value: fundamentals.valuation.ev_to_ebitda, format: 'ratio' },
              { label: 'EV/Revenue', value: fundamentals.valuation.ev_to_revenue, format: 'ratio' },
              { label: 'PEG Ratio', value: fundamentals.valuation.peg_ratio, format: 'ratio' },
            ]} />
            <MetricCard title="Growth" metrics={[
              { label: 'Revenue (YoY)', value: fundamentals.growth.revenue_growth_yoy, format: 'percent' },
              { label: 'Earnings (YoY)', value: fundamentals.growth.earnings_growth_yoy, format: 'percent' },
              { label: 'Earnings (QoQ)', value: fundamentals.growth.earnings_growth_quarterly, format: 'percent' },
              { label: 'Revenue (3Y)', value: fundamentals.growth.revenue_growth_3y, format: 'percent' },
              { label: 'Earnings (3Y)', value: fundamentals.growth.earnings_growth_3y, format: 'percent' },
              { label: 'Revenue (5Y)', value: fundamentals.growth.revenue_growth_5y, format: 'percent' },
              { label: 'Revenue (10Y)', value: fundamentals.growth.revenue_growth_10y, format: 'percent' },
            ]} />
            <MetricCard title="Profitability" metrics={[
              { label: 'Gross Margin', value: fundamentals.profitability.gross_margin, format: 'percent' },
              { label: 'EBITDA Margin', value: fundamentals.profitability.ebitda_margin, format: 'percent' },
              { label: 'Operating Margin', value: fundamentals.profitability.operating_margin, format: 'percent' },
              { label: 'Net Margin', value: fundamentals.profitability.net_margin, format: 'percent' },
              { label: 'ROE', value: fundamentals.profitability.roe, format: 'percent' },
              { label: 'ROA', value: fundamentals.profitability.roa, format: 'percent' },
            ]} />
            <MetricCard title="Financial Health" metrics={[
              { label: 'Current Ratio', value: fundamentals.quality.current_ratio, format: 'ratio' },
              { label: 'Quick Ratio', value: fundamentals.quality.quick_ratio, format: 'ratio' },
              { label: 'Debt/Equity', value: fundamentals.quality.debt_to_equity, format: 'ratio' },
              { label: 'Total Debt', value: fundamentals.quality.total_debt, format: 'compact' },
              { label: 'Total Cash', value: fundamentals.quality.total_cash, format: 'compact' },
              { label: 'FCF', value: fundamentals.quality.free_cash_flow, format: 'compact' },
              { label: 'Operating CF', value: fundamentals.quality.operating_cash_flow, format: 'compact' },
              { label: 'FCF Yield', value: fundamentals.quality.fcf_yield, format: 'percent' },
            ]} />
            <MetricCard title="Momentum" metrics={[
              { label: '1 Month', value: fundamentals.momentum.price_change_1m, format: 'percent' },
              { label: '3 Months', value: fundamentals.momentum.price_change_3m, format: 'percent' },
              { label: '6 Months', value: fundamentals.momentum.price_change_6m, format: 'percent' },
              { label: '1 Year', value: fundamentals.momentum.price_change_1y, format: 'percent' },
            ]} />
            <MetricCard title="Dividend" metrics={[
              { label: 'Dividend Yield', value: fundamentals.dividend.dividend_yield, format: 'percent' },
              { label: 'Payout Ratio', value: fundamentals.dividend.payout_ratio, format: 'percent' },
            ]} />
            <MetricCard title="Analyst Estimates" metrics={[
              { label: 'Rating', value: fundamentals.analyst.rating, format: 'raw' },
              { label: '# Analysts', value: fundamentals.analyst.num_analysts, format: 'raw' },
              { label: 'Target Mean', value: fundamentals.analyst.target_mean, format: 'currency' },
              { label: 'Target Median', value: fundamentals.analyst.target_median, format: 'currency' },
              { label: 'Target High', value: fundamentals.analyst.target_high, format: 'currency' },
              { label: 'Target Low', value: fundamentals.analyst.target_low, format: 'currency' },
            ]} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
