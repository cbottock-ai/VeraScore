import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStock, getFundamentals } from '@/services/api'
import { MetricCard } from '@/components/MetricCard'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function ResearchPage() {
  const { ticker } = useParams()

  const stockQuery = useQuery({
    queryKey: ['stock', ticker],
    queryFn: () => getStock(ticker!),
    enabled: !!ticker,
  })

  const fundamentalsQuery = useQuery({
    queryKey: ['fundamentals', ticker],
    queryFn: () => getFundamentals(ticker!),
    enabled: !!ticker,
  })

  if (!ticker) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">Research</h1>
        <p className="text-muted-foreground">
          Search for a stock to view scores, fundamentals, and analyst data.
        </p>
      </div>
    )
  }

  const stock = stockQuery.data
  const fundamentals = fundamentalsQuery.data

  return (
    <div>
      {/* Stock Header */}
      <div className="mb-6">
        {stockQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-40" />
          </div>
        ) : stock ? (
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold">{stock.name}</h1>
              <Badge variant="secondary">{stock.ticker}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {stock.sector && <span>{stock.sector}</span>}
              {stock.industry && <span>{stock.industry}</span>}
              {stock.exchange && <span>{stock.exchange}</span>}
            </div>
            {stock.price !== null && (
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-3xl font-semibold font-mono">
                  ${stock.price.toFixed(2)}
                </span>
                {stock.change_percent !== null && (
                  <span
                    className={`text-sm font-medium ${
                      stock.change_percent >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {stock.change_percent >= 0 ? '+' : ''}
                    {stock.change_percent.toFixed(2)}%
                  </span>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground ml-4">
                  {stock.beta !== null && <span>Beta: {stock.beta.toFixed(2)}</span>}
                  {stock.week_52_high !== null && stock.week_52_low !== null && (
                    <span>52W: ${stock.week_52_low.toFixed(2)} – ${stock.week_52_high.toFixed(2)}</span>
                  )}
                  {stock.market_cap !== null && (
                    <span>Mkt Cap: {formatCompact(stock.market_cap)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Stock not found.</p>
        )}
      </div>

      {/* Fundamentals Grid */}
      {fundamentalsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : fundamentals ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  )
}

function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}
