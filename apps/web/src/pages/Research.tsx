import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStock, getFundamentals, getScores, getEarningsCalendar, getEarningsHistory, listPortfolios, getPortfolio, getStockNews, getIncomeStatement, getAnalystEstimates, getStockPriceHistory, getStockProfile } from '@/services/api'
import type { EarningsRecord, UpcomingEarning, StockNews, IncomeStatement, AnalystEstimate } from '@/services/api'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { SP500_TICKERS, POPULAR_TICKERS } from '@/data/sp500'
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
    const relevant = earnings.filter(e => SP500_TICKERS.has(e.symbol) || POPULAR_TICKERS.has(e.symbol) || watchlistSet.has(e.symbol))
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
            <p className="text-xs text-muted-foreground mt-0.5">S&P 500 + popular · {weekFrom} – {weekTo}</p>
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
                          to={`/research/stock/${e.symbol}`}
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
                                to={`/research/stock/${e.symbol}`}
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

// ─── Research Landing Page ───────────────────────────────────────────────────

const RESEARCH_SECTIONS = [
  {
    to: '/research/earnings',
    label: 'Earnings Calendar',
    description: 'Upcoming S&P 500 earnings with weekly and monthly views',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    to: '/research/screener',
    label: 'Stock Screener',
    description: 'Filter S&P 500 by VeraScore, valuation, growth, and more',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
      </svg>
    ),
  },
  {
    to: '/research/sectors',
    label: 'Sectors',
    description: 'Sector performance, rotation, and market heat maps',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    to: '/research/analyst-ratings',
    label: 'Analyst Ratings',
    description: 'Recent upgrades, downgrades, and price target changes',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    to: '/research/insider-activity',
    label: 'Insider Activity',
    description: 'Insider buys and sells across S&P 500 companies',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
]

export function ResearchLandingPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Research</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tools and data to inform better investment decisions</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {RESEARCH_SECTIONS.map(s => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            className="group text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
              {s.icon}
            </div>
            <div className="text-sm font-semibold mb-1">{s.label}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{s.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Earnings sub-page ───────────────────────────────────────────────────────

export function EarningsResearchPage() {
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
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Earnings Calendar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">S&P 500 + popular stocks · upcoming reports</p>
      </div>
      <UpcomingEarningsCalendar watchlistTickers={watchlistTickers} />
    </div>
  )
}

// ─── Stock page ───────────────────────────────────────────────────────────────

type StockTab = 'overview' | 'financials' | 'news' | 'revenue' | 'profitability' | 'valuations' | 'estimates'

const TABS: { id: StockTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'financials', label: 'Financials' },
  { id: 'news', label: 'News' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'valuations', label: 'Valuations' },
  { id: 'estimates', label: 'Estimates' },
]

function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function formatNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

type PriceRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y'

function PriceChart({ ticker }: { ticker: string }) {
  const [range, setRange] = useState<PriceRange>('1Y')
  const { data: prices, isLoading } = useQuery({
    queryKey: ['priceHistory', ticker, range],
    queryFn: () => getStockPriceHistory(ticker, range),
    staleTime: 5 * 60 * 1000,
  })

  const isUp = prices && prices.length >= 2 ? prices[prices.length - 1].price >= prices[0].price : true
  const color = isUp ? '#22c55e' : '#ef4444'

  const minPrice = prices ? Math.min(...prices.map(p => p.price)) : 0
  const maxPrice = prices ? Math.max(...prices.map(p => p.price)) : 0
  const padding = (maxPrice - minPrice) * 0.08 || 1

  const formatXTick = (dateStr: string) => {
    const d = new Date(dateStr)
    if (range === '1W' || range === '1M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (range === '5Y') return d.getFullYear().toString()
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  const tickCount = range === '1W' ? 5 : range === '1M' ? 4 : range === '3M' ? 3 : range === '6M' ? 3 : range === '1Y' ? 4 : 5

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">Price</h2>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
          {(['1W', '1M', '3M', '6M', '1Y', '5Y'] as PriceRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 transition-colors ${range === r ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="w-full h-[200px] mt-1" />
      ) : !prices || prices.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No price data</div>
      ) : (
        <div className="mt-1">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={prices} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`priceGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatXTick}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickCount={tickCount}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minPrice - padding, maxPrice + padding]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(l) => new Date(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Price']}
              />
              <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill={`url(#priceGrad-${ticker})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function OverviewTab({
  stock,
  scores,
  fundamentals,
  scoresLoading,
  fundamentalsLoading,
}: {
  stock: import('@/types/stock').StockDetail
  scores: import('@/types/stock').StockScoresResponse | undefined
  fundamentals: import('@/types/stock').FundamentalsResponse | undefined
  scoresLoading: boolean
  fundamentalsLoading: boolean
}) {
  return (
    <div className="space-y-6">
      {/* VeraScore + Price Chart side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {scoresLoading ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : scores ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">VeraScore</h2>
            <div className="flex items-center gap-6 flex-wrap">
              <ScoreGauge score={scores.overall_score} label="Overall Score" size="lg" />
              <div className="flex-1 min-w-[180px] divide-y divide-border/50">
                {Object.values(scores.factors).map((f) => (
                  <FactorBar key={f.factor} factor={f} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center text-sm text-muted-foreground">
            No score data available
          </div>
        )}
        <PriceChart ticker={stock.ticker} />
      </div>

      {/* Category Highlights */}
      {fundamentals && !fundamentalsLoading && (
        <div>
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">At a Glance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Valuation */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valuation</div>
              {[
                { label: 'Forward P/E', value: fundamentals.valuation.pe_ntm != null ? `${formatNum(fundamentals.valuation.pe_ntm)}x` : '—' },
                { label: 'Forward EPS', value: fundamentals.valuation.eps_ntm != null ? `$${formatNum(fundamentals.valuation.eps_ntm)}` : '—' },
                { label: 'EV / EBITDA', value: fundamentals.valuation.ev_to_ebitda != null ? `${formatNum(fundamentals.valuation.ev_to_ebitda)}x` : '—' },
                { label: 'PEG Ratio', value: fundamentals.valuation.peg_ratio != null ? `${formatNum(fundamentals.valuation.peg_ratio)}x` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium tabular-nums">{value}</span>
                </div>
              ))}
            </div>
            {/* Growth */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Growth</div>
              {[
                { label: 'Revenue YoY', pct: fundamentals.growth.revenue_growth_yoy },
                { label: 'Earnings YoY', pct: fundamentals.growth.earnings_growth_yoy },
                { label: 'Revenue 3Y CAGR', pct: fundamentals.growth.revenue_growth_3y },
                { label: 'Earnings 3Y CAGR', pct: fundamentals.growth.earnings_growth_3y },
              ].map(({ label, pct }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-mono font-medium tabular-nums ${pct != null ? (pct >= 0 ? 'text-green-500' : 'text-red-500') : ''}`}>
                    {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
            {/* Profitability */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profitability</div>
              {[
                { label: 'Gross Margin', v: fundamentals.profitability.gross_margin },
                { label: 'Operating Margin', v: fundamentals.profitability.operating_margin },
                { label: 'Net Margin', v: fundamentals.profitability.net_margin },
                { label: 'ROE', v: fundamentals.profitability.roe },
              ].map(({ label, v }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium tabular-nums">{v != null ? `${v.toFixed(1)}%` : '—'}</span>
                </div>
              ))}
            </div>
            {/* Momentum */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Momentum</div>
              {[
                { label: '1-Month', pct: fundamentals.momentum.price_change_1m },
                { label: '3-Month', pct: fundamentals.momentum.price_change_3m },
                { label: '6-Month', pct: fundamentals.momentum.price_change_6m },
                { label: '1-Year', pct: fundamentals.momentum.price_change_1y },
              ].map(({ label, pct }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-mono font-medium tabular-nums ${pct != null ? (pct >= 0 ? 'text-green-500' : 'text-red-500') : ''}`}>
                    {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
            {/* Financial Health */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Health</div>
              {[
                { label: 'Current Ratio', value: fundamentals.quality.current_ratio != null ? formatNum(fundamentals.quality.current_ratio) : '—' },
                { label: 'Debt / Equity', value: fundamentals.quality.debt_to_equity != null ? `${formatNum(fundamentals.quality.debt_to_equity)}x` : '—' },
                { label: 'FCF Yield', value: fundamentals.quality.fcf_yield != null ? `${fundamentals.quality.fcf_yield.toFixed(1)}%` : '—' },
                { label: 'Free Cash Flow', value: fundamentals.quality.free_cash_flow != null ? formatCompact(fundamentals.quality.free_cash_flow) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium tabular-nums">{value}</span>
                </div>
              ))}
            </div>
            {/* Analyst */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analyst Consensus</div>
              {[
                { label: 'Rating', value: fundamentals.analyst.rating ?? '—' },
                { label: 'Price Target (NTM)', value: fundamentals.analyst.target_mean != null ? `$${formatNum(fundamentals.analyst.target_mean)}` : '—' },
                { label: 'Target High', value: fundamentals.analyst.target_high != null ? `$${formatNum(fundamentals.analyst.target_high)}` : '—' },
                { label: '# Analysts', value: fundamentals.analyst.num_analysts != null ? String(fundamentals.analyst.num_analysts) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Company Summary */}
      <CompanySummary ticker={stock.ticker} />
    </div>
  )
}

function CompanySummary({ ticker }: { ticker: string }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['stockProfile', ticker],
    queryFn: () => getStockProfile(ticker),
    staleTime: 60 * 60 * 1000,
  })

  if (isLoading) return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )

  if (!profile?.description) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">About</h2>
      <p className="text-sm text-foreground leading-relaxed">{profile.description}</p>
      {(profile.headquarters || profile.full_time_employees || profile.website) && (
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
          {profile.headquarters && <span>📍 {profile.headquarters}</span>}
          {profile.full_time_employees && <span>👥 {profile.full_time_employees.toLocaleString()} employees</span>}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-2">
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Financials Tab ────────────────────────────────────────────────────────────

function FinancialsTab({ ticker }: { ticker: string }) {
  const [period, setPeriod] = useState<'annual' | 'quarter'>('annual')

  const { data: statements, isLoading } = useQuery({
    queryKey: ['incomeStatement', ticker, period],
    queryFn: () => getIncomeStatement(ticker, period),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Income Statement</h2>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
          {(['annual', 'quarter'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {p === 'annual' ? 'Annual' : 'Quarterly'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !statements || statements.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No income statement data available.</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Date', 'Revenue', 'Gross Profit', 'Operating Income', 'Net Income', 'EPS'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-right first:text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statements.map((s: IncomeStatement, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{s.date ? s.date.slice(0, 4) + (period === 'quarter' ? ' ' + s.date : '') : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <div className="font-mono text-sm">{s.revenue !== null ? formatCompact(s.revenue) : '—'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <div className="font-mono text-sm">{s.gross_profit !== null ? formatCompact(s.gross_profit) : '—'}</div>
                      {s.gross_profit_ratio !== null && <div className="text-[10px] text-green-500 font-medium">{(s.gross_profit_ratio * 100).toFixed(1)}%</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <div className="font-mono text-sm">{s.operating_income !== null ? formatCompact(s.operating_income) : '—'}</div>
                      {s.operating_income_ratio !== null && <div className={`text-[10px] font-medium ${s.operating_income_ratio >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{(s.operating_income_ratio * 100).toFixed(1)}%</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <div className="font-mono text-sm">{s.net_income !== null ? formatCompact(s.net_income) : '—'}</div>
                      {s.net_income_ratio !== null && <div className={`text-[10px] font-medium ${s.net_income_ratio >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{(s.net_income_ratio * 100).toFixed(1)}%</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums">
                      {s.eps !== null ? `$${s.eps.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── News Tab ─────────────────────────────────────────────────────────────────

function NewsTab({ ticker }: { ticker: string }) {
  const { data: news, isLoading } = useQuery({
    queryKey: ['stockNews', ticker],
    queryFn: () => getStockNews(ticker),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 flex gap-4">
            <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!news || news.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No news articles available for {ticker}.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {news.slice(0, 20).map((article: StockNews, i: number) => {
        const hue = (article.site ?? ticker).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
        return (
          <div key={i} className="rounded-xl border border-border bg-card p-4 flex gap-4 hover:border-primary/30 transition-colors">
            {/* Image or colored placeholder */}
            <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {article.image ? (
                <img
                  src={article.image}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).style.backgroundColor = `hsl(${hue} 45% 35%)` }}
                />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor: `hsl(${hue} 45% 35%)` }} />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {article.publisher && <span className="font-medium">{article.publisher}</span>}
                {article.publisher && article.published_date && <span>·</span>}
                {article.published_date && <span>{formatDate(article.published_date)}</span>}
              </div>
              {article.url ? (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold leading-snug hover:text-primary transition-colors line-clamp-2"
                >
                  {article.title}
                </a>
              ) : (
                <p className="text-sm font-semibold leading-snug line-clamp-2">{article.title}</p>
              )}
              {article.text && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{article.text}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────

function RevenueTab({
  ticker,
  fundamentals,
  fundamentalsLoading,
}: {
  ticker: string
  fundamentals: import('@/types/stock').FundamentalsResponse | undefined
  fundamentalsLoading: boolean
}) {
  const [period, setPeriod] = useState<'annual' | 'quarter'>('annual')

  const { data: statements, isLoading } = useQuery({
    queryKey: ['incomeStatement', ticker, period],
    queryFn: () => getIncomeStatement(ticker, period),
    staleTime: 10 * 60 * 1000,
  })

  const growthMetrics = fundamentals ? [
    { label: 'Revenue YoY', value: fundamentals.growth.revenue_growth_yoy },
    { label: 'Revenue 3Y CAGR', value: fundamentals.growth.revenue_growth_3y },
    { label: 'Revenue 5Y CAGR', value: fundamentals.growth.revenue_growth_5y },
    { label: 'Revenue 10Y CAGR', value: fundamentals.growth.revenue_growth_10y },
    { label: 'Earnings YoY', value: fundamentals.growth.earnings_growth_yoy },
    { label: 'Earnings QoQ', value: fundamentals.growth.earnings_growth_quarterly },
    { label: 'Earnings 3Y CAGR', value: fundamentals.growth.earnings_growth_3y },
    { label: 'Earnings 5Y CAGR', value: fundamentals.growth.earnings_growth_5y },
  ] : []

  return (
    <div className="space-y-6">
      {/* Growth Rate Cards */}
      <div>
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Growth Rates</h2>
        {fundamentalsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {growthMetrics.map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className={`text-xl font-semibold font-mono tabular-nums ${
                  value === null || value === undefined ? 'text-muted-foreground' :
                  value >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {value !== null && value !== undefined
                    ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
                    : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue History Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">Revenue History</h2>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            {(['annual', 'quarter'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                {p === 'annual' ? 'Annual' : 'Quarterly'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !statements || statements.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No revenue data available.</div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Period', 'Revenue', 'YoY Growth', 'Gross Profit', 'Gross Margin', 'EBITDA', 'EBITDA Margin'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-right first:text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s: IncomeStatement, i: number) => {
                    const prev = statements[i + 1]
                    const yoyGrowth = prev?.revenue && s.revenue
                      ? (s.revenue - prev.revenue) / Math.abs(prev.revenue)
                      : null
                    const label = period === 'annual'
                      ? s.date?.slice(0, 4)
                      : s.date?.slice(0, 7)
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{label ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums font-semibold">
                          {s.revenue !== null ? formatCompact(s.revenue) : '—'}
                        </td>
                        <td className={`px-4 py-2.5 font-mono text-sm text-right tabular-nums font-medium ${
                          yoyGrowth === null ? 'text-muted-foreground' : yoyGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {yoyGrowth !== null ? `${yoyGrowth >= 0 ? '+' : ''}${(yoyGrowth * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums text-muted-foreground">
                          {s.gross_profit !== null ? formatCompact(s.gross_profit) : '—'}
                        </td>
                        <td className={`px-4 py-2.5 font-mono text-sm text-right tabular-nums font-medium ${s.gross_profit_ratio !== null ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {s.gross_profit_ratio !== null ? `${(s.gross_profit_ratio * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums text-muted-foreground">
                          {s.ebitda !== null ? formatCompact(s.ebitda) : '—'}
                        </td>
                        <td className={`px-4 py-2.5 font-mono text-sm text-right tabular-nums font-medium ${s.ebitda_ratio !== null ? 'text-violet-500' : 'text-muted-foreground'}`}>
                          {s.ebitda_ratio !== null ? `${(s.ebitda_ratio * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Profitability Tab ────────────────────────────────────────────────────────

function ProfitabilityTab({
  ticker,
  fundamentals,
  fundamentalsLoading,
}: {
  ticker: string
  fundamentals: import('@/types/stock').FundamentalsResponse | undefined
  fundamentalsLoading: boolean
}) {
  const { data: statements, isLoading: stmtLoading } = useQuery({
    queryKey: ['incomeStatement', ticker, 'annual'],
    queryFn: () => getIncomeStatement(ticker, 'annual'),
    staleTime: 10 * 60 * 1000,
  })

  const profitMetrics = fundamentals ? [
    { label: 'Gross Margin', value: fundamentals.profitability.gross_margin, color: 'text-green-500' },
    { label: 'Operating Margin', value: fundamentals.profitability.operating_margin, color: 'text-blue-500' },
    { label: 'Net Margin', value: fundamentals.profitability.net_margin, color: 'text-emerald-500' },
    { label: 'EBITDA Margin', value: fundamentals.profitability.ebitda_margin, color: 'text-violet-500' },
    { label: 'ROE', value: fundamentals.profitability.roe, color: 'text-amber-500' },
    { label: 'ROA', value: fundamentals.profitability.roa, color: 'text-cyan-500' },
    { label: 'FCF Yield', value: fundamentals.quality.fcf_yield, color: 'text-orange-500' },
  ] : []

  return (
    <div className="space-y-6">
      {/* Current Margins */}
      <div>
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Current Margins &amp; Returns</h2>
        {fundamentalsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {profitMetrics.map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className={`text-xl font-semibold font-mono tabular-nums ${value !== null && value !== undefined ? color : 'text-muted-foreground'}`}>
                  {value !== null && value !== undefined ? formatPct(value) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical Margin Trend */}
      <div>
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Margin History (Annual)</h2>
        {stmtLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !statements || statements.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No historical data available.</div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Year', 'Revenue', 'Gross Margin', 'Operating Margin', 'Net Margin', 'EBITDA Margin'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-right first:text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s: IncomeStatement, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium">{s.date ? s.date.slice(0, 4) : '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums">{s.revenue !== null ? formatCompact(s.revenue) : '—'}</td>
                      <td className={`px-4 py-2.5 font-mono text-sm text-right tabular-nums font-medium ${s.gross_profit_ratio !== null ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {s.gross_profit_ratio !== null ? `${(s.gross_profit_ratio * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className={`px-4 py-2.5 font-mono text-sm text-right tabular-nums font-medium ${s.operating_income_ratio !== null ? (s.operating_income_ratio >= 0 ? 'text-blue-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                        {s.operating_income_ratio !== null ? `${(s.operating_income_ratio * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className={`px-4 py-2.5 font-mono text-sm text-right tabular-nums font-medium ${s.net_income_ratio !== null ? (s.net_income_ratio >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                        {s.net_income_ratio !== null ? `${(s.net_income_ratio * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className={`px-4 py-2.5 font-mono text-sm text-right tabular-nums font-medium ${s.ebitda_ratio !== null ? 'text-violet-500' : 'text-muted-foreground'}`}>
                        {s.ebitda_ratio !== null ? `${(s.ebitda_ratio * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Valuations Tab ───────────────────────────────────────────────────────────

function ValuationsTab({
  fundamentals,
  fundamentalsLoading,
  stock,
}: {
  fundamentals: import('@/types/stock').FundamentalsResponse | undefined
  fundamentalsLoading: boolean
  stock: import('@/types/stock').StockDetail
}) {
  const valMetrics = fundamentals ? [
    { label: 'P/E (TTM)', value: fundamentals.valuation.pe_ttm, suffix: 'x' },
    { label: 'P/E (NTM)', value: fundamentals.valuation.pe_ntm, suffix: 'x' },
    { label: 'P/B', value: fundamentals.valuation.pb_ratio, suffix: 'x' },
    { label: 'P/S (TTM)', value: fundamentals.valuation.ps_ttm, suffix: 'x' },
    { label: 'EV/EBITDA', value: fundamentals.valuation.ev_to_ebitda, suffix: 'x' },
    { label: 'EV/Revenue', value: fundamentals.valuation.ev_to_revenue, suffix: 'x' },
    { label: 'PEG Ratio', value: fundamentals.valuation.peg_ratio, suffix: 'x' },
    { label: 'EPS (TTM)', value: fundamentals.valuation.eps_ttm, prefix: '$', suffix: '' },
    { label: 'EPS (NTM)', value: fundamentals.valuation.eps_ntm, prefix: '$', suffix: '' },
  ] : []

  const analyst = fundamentals?.analyst

  return (
    <div className="space-y-6">
      {/* Valuation Multiples Grid */}
      <div>
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Valuation Multiples</h2>
        {fundamentalsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {valMetrics.map(({ label, value, suffix = '', prefix = '' }) => (
              <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className="text-xl font-semibold font-mono tabular-nums">
                  {value !== null && value !== undefined ? `${prefix}${value.toFixed(2)}${suffix}` : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analyst Price Target */}
      <div>
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Analyst Price Targets</h2>
        {fundamentalsLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : analyst ? (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Consensus Rating</div>
                <div className="text-lg font-semibold">{analyst.rating ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Analysts</div>
                <div className="text-lg font-semibold font-mono">{analyst.num_analysts ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Price Target (Mean)</div>
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {analyst.target_mean !== null ? `$${analyst.target_mean.toFixed(2)}` : '—'}
                </div>
              </div>
              {stock.price !== null && analyst.target_mean !== null && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Upside / Downside</div>
                  <div className={`text-lg font-bold font-mono ${analyst.target_mean >= stock.price ? 'text-green-500' : 'text-red-500'}`}>
                    {analyst.target_mean >= stock.price ? '▲' : '▼'} {Math.abs(((analyst.target_mean - stock.price) / stock.price) * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
              {[
                { label: 'PT Low', value: analyst.target_low },
                { label: 'PT Median', value: analyst.target_median },
                { label: 'PT High', value: analyst.target_high },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                  <div className="text-base font-semibold font-mono tabular-nums">
                    {value !== null ? `$${value.toFixed(2)}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No analyst data available.</div>
        )}
      </div>
    </div>
  )
}

// ─── Estimates Tab ────────────────────────────────────────────────────────────

function EstimatesTab({ ticker }: { ticker: string }) {
  const [period, setPeriod] = useState<'annual' | 'quarter'>('annual')

  const { data: estimates, isLoading } = useQuery({
    queryKey: ['analystEstimates', ticker, period],
    queryFn: () => getAnalystEstimates(ticker, period),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <div className="space-y-6">
      {/* Analyst Estimates Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">Forward Estimates</h2>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            {(['annual', 'quarter'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                {p === 'annual' ? 'Annual' : 'Quarterly'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !estimates || estimates.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No analyst estimate data available.</div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Date', 'Revenue Est', 'EPS (Low)', 'EPS (Avg)', 'EPS (High)', '# Analysts'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-right first:text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((e: AnalystEstimate, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{e.date ? e.date.slice(0, 7) : '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="font-mono text-sm">{e.revenue_avg !== null ? formatCompact(e.revenue_avg) : '—'}</div>
                        {e.revenue_low !== null && e.revenue_high !== null && (
                          <div className="text-[10px] text-muted-foreground">{formatCompact(e.revenue_low)} – {formatCompact(e.revenue_high)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums text-red-400">
                        {e.eps_low !== null ? `$${e.eps_low.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums font-semibold">
                        {e.eps_avg !== null ? `$${e.eps_avg.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums text-green-500">
                        {e.eps_high !== null ? `$${e.eps_high.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-right tabular-nums text-muted-foreground">
                        {e.num_analysts_eps ?? e.num_analysts_revenue ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Earnings History */}
      <div>
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Earnings History</h2>
        <EarningsHistorySection ticker={ticker} />
      </div>
    </div>
  )
}

// ─── Main StockResearchPage ────────────────────────────────────────────────────

// ─── Stock Chat Panel ──────────────────────────────────────────────────────────

interface ChatMsg { role: 'user' | 'assistant'; content: string }

function StockChatPanel({
  ticker,
  activeTab,
  context,
  open,
  onClose,
}: {
  ticker: string
  activeTab: string
  context: Record<string, unknown>
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    const allMessages = [...messages, userMsg]
    let accumulated = ''

    try {
      const response = await fetch(`/api/stocks/${ticker}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          active_tab: activeTab,
          context,
        }),
      })

      if (!response.ok) throw new Error(`${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let buffer = ''

      // Add placeholder assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            accumulated += JSON.parse(data)
            setMessages(prev => {
              const next = [...prev]
              next[next.length - 1] = { role: 'assistant', content: accumulated }
              return next
            })
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, messages, ticker, activeTab, context])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const tabLabel = activeTab.charAt(0).toUpperCase() + activeTab.slice(1)

  return (
    <>
      {/* Backdrop (mobile) */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-[380px] z-40 flex flex-col bg-card border-l border-border shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <div className="text-sm font-semibold">{ticker} — AI Analyst</div>
            <div className="text-xs text-muted-foreground">{tabLabel} context loaded</div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
                Clear
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="text-center text-sm text-muted-foreground py-8 space-y-3">
              <div className="text-2xl">📊</div>
              <p className="font-medium text-foreground">Ask anything about {ticker}</p>
              <p>I have full access to the data on this page. Try asking:</p>
              <div className="space-y-2 text-left">
                {[
                  `What are ${ticker}'s biggest strengths?`,
                  `How do the margins compare to typical ${context.sector ?? 'industry'} companies?`,
                  `What does the valuation suggest about growth expectations?`,
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}>
                {msg.content || (streaming && i === messages.length - 1 ? (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                ) : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this stock…"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ minHeight: '40px' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              className="shrink-0 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </>
  )
}

export function StockResearchPage() {
  const { ticker } = useParams()
  const [activeTab, setActiveTab] = useState<StockTab>('overview')
  const [chatOpen, setChatOpen] = useState(false)

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

  const stock = stockQuery.data
  const scores = scoresQuery.data
  const fundamentals = fundamentalsQuery.data

  // Context passed to the AI chat — includes all loaded data
  const chatContext = useMemo(() => ({
    name: stock?.name,
    sector: stock?.sector,
    industry: stock?.industry,
    price: stock?.price,
    market_cap: stock?.market_cap,
    week_52_high: stock?.week_52_high,
    week_52_low: stock?.week_52_low,
    beta: stock?.beta,
    data: {
      scores: scores ? {
        overall: scores.overall_score,
        factors: Object.fromEntries(
          Object.values(scores.factors).map(f => [f.factor, { score: f.score, label: f.label }])
        ),
      } : undefined,
      valuation: fundamentals?.valuation,
      growth: fundamentals?.growth,
      profitability: fundamentals?.profitability,
      quality: fundamentals?.quality,
      momentum: fundamentals?.momentum,
      analyst: fundamentals?.analyst,
    },
  }), [stock, scores, fundamentals])

  return (
    <div className="space-y-0">
      {/* ── Stock Header Card ─────────────────────────────────────────────── */}
      {stockQuery.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-5 mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-4 w-72" />
        </div>
      ) : stock ? (
        <div className="rounded-xl border border-border bg-card p-5 mb-4">
          {/* Top row: logo + name + price */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <TickerLogo symbol={stock.ticker} size="md" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{stock.ticker}</h1>
                  <span className="text-sm text-muted-foreground font-normal">{stock.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                  {stock.sector && <span>{stock.sector}</span>}
                  {stock.sector && stock.industry && <span className="text-border">·</span>}
                  {stock.industry && <span>{stock.industry}</span>}
                  {stock.exchange && <><span className="text-border">·</span><span>{stock.exchange}</span></>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
              <button
                onClick={() => setChatOpen(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  chatOpen
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Ask AI
              </button>
            </div>
          </div>

          {/* Bottom meta row */}
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {stock.market_cap !== null && (
              <span>Market Cap <span className="text-foreground font-medium">{formatCompact(stock.market_cap)}</span></span>
            )}
            {stock.week_52_high !== null && stock.week_52_low !== null && (
              <span>52W Range <span className="text-foreground font-medium">${stock.week_52_low.toFixed(2)} – ${stock.week_52_high.toFixed(2)}</span></span>
            )}
            {stock.beta !== null && (
              <span>Beta <span className="text-foreground font-medium">{stock.beta.toFixed(2)}</span></span>
            )}
            {stock.avg_volume !== null && (
              <span>Avg Vol <span className="text-foreground font-medium">{formatCompact(stock.avg_volume)}</span></span>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 mb-4">
          <p className="text-muted-foreground">Stock not found.</p>
        </div>
      )}

      {/* ── Tab Bar (sticky) ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border -mx-4 px-4 sm:-mx-6 sm:px-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-0 overflow-x-auto scrollbar-none flex-1">
            {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      {ticker && stock && (
        <>
          {activeTab === 'overview' && (
            <OverviewTab
              stock={stock}
              scores={scores}
              fundamentals={fundamentals}
              scoresLoading={scoresQuery.isLoading}
              fundamentalsLoading={fundamentalsQuery.isLoading}
            />
          )}
          {activeTab === 'financials' && (
            <FinancialsTab ticker={ticker} />
          )}
          {activeTab === 'news' && (
            <NewsTab ticker={ticker} />
          )}
          {activeTab === 'revenue' && (
            <RevenueTab
              ticker={ticker}
              fundamentals={fundamentals}
              fundamentalsLoading={fundamentalsQuery.isLoading}
            />
          )}
          {activeTab === 'profitability' && (
            <ProfitabilityTab
              ticker={ticker}
              fundamentals={fundamentals}
              fundamentalsLoading={fundamentalsQuery.isLoading}
            />
          )}
          {activeTab === 'valuations' && (
            <ValuationsTab
              fundamentals={fundamentals}
              fundamentalsLoading={fundamentalsQuery.isLoading}
              stock={stock}
            />
          )}
          {activeTab === 'estimates' && (
            <EstimatesTab ticker={ticker} />
          )}
        </>
      )}

      {/* Loading state when stock hasn't loaded yet */}
      {!stock && !stockQuery.isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Ticker not found.
        </div>
      )}

      {/* AI Chat Panel */}
      {ticker && (
        <StockChatPanel
          ticker={ticker.toUpperCase()}
          activeTab={activeTab}
          context={chatContext}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}
