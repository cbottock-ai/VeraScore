import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStock, getFundamentals, getScores, getEarningsCalendar, getEarningsHistory, listPortfolios, getPortfolio } from '@/services/api'
import type { EarningsRecord } from '@/services/api'
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

function TickerLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false)
  const initials = symbol.slice(0, 2)
  // Deterministic hue from ticker string
  const hue = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360

  if (failed) {
    return (
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
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
      className="w-7 h-7 rounded-md object-contain bg-white shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

// ─── Upcoming Earnings Calendar ──────────────────────────────────────────────

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

function isWeekend(dateStr: string) {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6
}

function UpcomingEarningsCalendar({ watchlistTickers }: { watchlistTickers: string[] }) {
  const [watchlistOnly, setWatchlistOnly] = useState(false)
  const watchlistSet = new Set(watchlistTickers)

  const { data, isLoading } = useQuery({
    queryKey: ['earningsCalendar', 'all'],
    queryFn: () => getEarningsCalendar(),
    staleTime: 5 * 60 * 1000,
  })

  const allEarnings = data?.earnings ?? []
  const relevant = allEarnings.filter(e => SP500_TICKERS.has(e.symbol) || watchlistSet.has(e.symbol))
  const displayed = watchlistOnly ? relevant.filter(e => watchlistSet.has(e.symbol)) : relevant

  const byDate = displayed.reduce<Record<string, typeof displayed>>((acc, e) => {
    if (!isWeekend(e.date)) {
      acc[e.date] = acc[e.date] ?? []
      acc[e.date].push(e)
    }
    return acc
  }, {})

  const sortedDates = Object.keys(byDate).sort()
  for (const date of sortedDates) {
    byDate[date].sort((a, b) => {
      const aW = watchlistSet.has(a.symbol) ? 0 : 1
      const bW = watchlistSet.has(b.symbol) ? 0 : 1
      return aW - bW || a.symbol.localeCompare(b.symbol)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Earnings Calendar</h2>
          <p className="text-xs text-muted-foreground mt-0.5">S&P 500 · Next 14 days</p>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {displayed.length} reports
            </span>
          )}
          <button
            onClick={() => setWatchlistOnly(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
              watchlistOnly
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Watchlist only
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-none w-36 rounded-xl border border-border bg-card p-3 space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-3/4 rounded-lg" />
            </div>
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {watchlistOnly ? 'No watchlist earnings in the next 14 days' : 'No S&P 500 earnings found'}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {sortedDates.map(date => {
            const { weekday, date: dateLabel } = dayLabel(date)
            const items = byDate[date]
            return (
              <div key={date} className="flex-none w-40 rounded-xl border border-border bg-card overflow-hidden">
                {/* Day header */}
                <div className="px-3 py-2.5 border-b border-border bg-muted/30 text-center">
                  <div className="text-xs font-bold text-foreground uppercase tracking-wide">{weekday}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{dateLabel}</div>
                </div>
                {/* Ticker chips */}
                <div className="p-2 space-y-1.5">
                  {items.map((e, i) => {
                    const isWL = watchlistSet.has(e.symbol)
                    return (
                      <Link
                        key={i}
                        to={`/research/${e.symbol}`}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors group ${
                          isWL
                            ? 'bg-primary/10 border border-primary/30 hover:bg-primary/15'
                            : 'bg-muted/50 border border-transparent hover:bg-muted'
                        }`}
                      >
                        <TickerLogo symbol={e.symbol} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs font-bold font-mono leading-none ${isWL ? 'text-primary' : 'text-foreground'}`}>
                              {e.symbol}
                            </span>
                            {e.time && (
                              <span className="text-[9px] text-muted-foreground font-medium leading-none shrink-0">
                                {e.time === 'bmo' ? '▲' : e.time === 'amc' ? '▼' : ''}
                              </span>
                            )}
                          </div>
                          {e.name && (
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">
                              {e.name}
                            </div>
                          )}
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
      <div className="space-y-4 max-w-3xl">
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
