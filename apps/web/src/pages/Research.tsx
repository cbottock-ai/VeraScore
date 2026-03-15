import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStock, getFundamentals, getScores } from '@/services/api'
import { MetricCard } from '@/components/MetricCard'
import { ScoreGauge, FactorBar, FactorCard } from '@/components/ScoreCard'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function ResearchPage() {
  const { ticker } = useParams()

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

  if (!ticker) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold mb-1">Research a Stock</h1>
          <p className="text-muted-foreground text-sm">Search for a ticker in the header to view scores, fundamentals, and analysis.</p>
        </div>
      </div>
    )
  }

  const stock = stockQuery.data
  const scores = scoresQuery.data
  const fundamentals = fundamentalsQuery.data

  return (
    <div className="space-y-6">
      {/* ── Stock Header ────────────────────────────────────────────── */}
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
                {stock.exchange && (
                  <>
                    <span className="text-border">·</span>
                    <span>{stock.exchange}</span>
                  </>
                )}
              </div>
            </div>
            {stock.price !== null && (
              <div className="text-right">
                <div className="text-3xl font-semibold font-mono tabular-nums">
                  ${stock.price.toFixed(2)}
                </div>
                {stock.change_percent !== null && (
                  <span
                    className={`text-sm font-medium ${stock.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {stock.change_percent >= 0 ? '▲' : '▼'} {Math.abs(stock.change_percent).toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          {stock.price !== null && (
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {stock.market_cap !== null && (
                <span>Market Cap <span className="text-foreground font-medium">{formatCompact(stock.market_cap)}</span></span>
              )}
              {stock.beta !== null && (
                <span>Beta <span className="text-foreground font-medium">{stock.beta.toFixed(2)}</span></span>
              )}
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

      {/* ── VeraScore Hero ───────────────────────────────────────────── */}
      {scoresQuery.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : scores ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">VeraScore</h2>
          <div className="flex items-center gap-8 flex-wrap">
            {/* Big gauge */}
            <ScoreGauge score={scores.overall_score} label="Overall Score" size="lg" />

            {/* Factor bars */}
            <div className="flex-1 min-w-[220px] divide-y divide-border/50">
              {Object.values(scores.factors).map((f) => (
                <FactorBar key={f.factor} factor={f} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Score Breakdown ──────────────────────────────────────────── */}
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

      {/* ── Fundamentals ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Fundamentals</h2>
        {fundamentalsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : fundamentals ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <MetricCard
              title="Valuation"
              metrics={[
                { label: 'P/E (TTM)', value: fundamentals.valuation.pe_ttm, format: 'ratio' },
                { label: 'P/E (NTM)', value: fundamentals.valuation.pe_ntm, format: 'ratio' },
                { label: 'EPS (TTM)', value: fundamentals.valuation.eps_ttm, format: 'currency' },
                { label: 'EPS (NTM)', value: fundamentals.valuation.eps_ntm, format: 'currency' },
                { label: 'P/B', value: fundamentals.valuation.pb_ratio, format: 'ratio' },
                { label: 'P/S (TTM)', value: fundamentals.valuation.ps_ttm, format: 'ratio' },
                { label: 'EV/EBITDA', value: fundamentals.valuation.ev_to_ebitda, format: 'ratio' },
                { label: 'EV/Revenue', value: fundamentals.valuation.ev_to_revenue, format: 'ratio' },
                { label: 'PEG Ratio', value: fundamentals.valuation.peg_ratio, format: 'ratio' },
              ]}
            />
            <MetricCard
              title="Growth"
              metrics={[
                { label: 'Revenue (YoY)', value: fundamentals.growth.revenue_growth_yoy, format: 'percent' },
                { label: 'Earnings (YoY)', value: fundamentals.growth.earnings_growth_yoy, format: 'percent' },
                { label: 'Earnings (QoQ)', value: fundamentals.growth.earnings_growth_quarterly, format: 'percent' },
                { label: 'Revenue (3Y)', value: fundamentals.growth.revenue_growth_3y, format: 'percent' },
                { label: 'Earnings (3Y)', value: fundamentals.growth.earnings_growth_3y, format: 'percent' },
                { label: 'Revenue (5Y)', value: fundamentals.growth.revenue_growth_5y, format: 'percent' },
                { label: 'Revenue (10Y)', value: fundamentals.growth.revenue_growth_10y, format: 'percent' },
              ]}
            />
            <MetricCard
              title="Profitability"
              metrics={[
                { label: 'Gross Margin', value: fundamentals.profitability.gross_margin, format: 'percent' },
                { label: 'EBITDA Margin', value: fundamentals.profitability.ebitda_margin, format: 'percent' },
                { label: 'Operating Margin', value: fundamentals.profitability.operating_margin, format: 'percent' },
                { label: 'Net Margin', value: fundamentals.profitability.net_margin, format: 'percent' },
                { label: 'ROE', value: fundamentals.profitability.roe, format: 'percent' },
                { label: 'ROA', value: fundamentals.profitability.roa, format: 'percent' },
              ]}
            />
            <MetricCard
              title="Financial Health"
              metrics={[
                { label: 'Current Ratio', value: fundamentals.quality.current_ratio, format: 'ratio' },
                { label: 'Quick Ratio', value: fundamentals.quality.quick_ratio, format: 'ratio' },
                { label: 'Debt/Equity', value: fundamentals.quality.debt_to_equity, format: 'ratio' },
                { label: 'Total Debt', value: fundamentals.quality.total_debt, format: 'compact' },
                { label: 'Total Cash', value: fundamentals.quality.total_cash, format: 'compact' },
                { label: 'FCF', value: fundamentals.quality.free_cash_flow, format: 'compact' },
                { label: 'Operating CF', value: fundamentals.quality.operating_cash_flow, format: 'compact' },
                { label: 'FCF Yield', value: fundamentals.quality.fcf_yield, format: 'percent' },
              ]}
            />
            <MetricCard
              title="Momentum"
              metrics={[
                { label: '1 Month', value: fundamentals.momentum.price_change_1m, format: 'percent' },
                { label: '3 Months', value: fundamentals.momentum.price_change_3m, format: 'percent' },
                { label: '6 Months', value: fundamentals.momentum.price_change_6m, format: 'percent' },
                { label: '1 Year', value: fundamentals.momentum.price_change_1y, format: 'percent' },
              ]}
            />
            <MetricCard
              title="Dividend"
              metrics={[
                { label: 'Dividend Yield', value: fundamentals.dividend.dividend_yield, format: 'percent' },
                { label: 'Payout Ratio', value: fundamentals.dividend.payout_ratio, format: 'percent' },
              ]}
            />
            <MetricCard
              title="Analyst Estimates"
              metrics={[
                { label: 'Rating', value: fundamentals.analyst.rating, format: 'raw' },
                { label: '# Analysts', value: fundamentals.analyst.num_analysts, format: 'raw' },
                { label: 'Target Mean', value: fundamentals.analyst.target_mean, format: 'currency' },
                { label: 'Target Median', value: fundamentals.analyst.target_median, format: 'currency' },
                { label: 'Target High', value: fundamentals.analyst.target_high, format: 'currency' },
                { label: 'Target Low', value: fundamentals.analyst.target_low, format: 'currency' },
              ]}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}
