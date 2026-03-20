import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getInsiderTrades, listPortfolios, getPortfolio } from '@/services/api'
import type { InsiderTrade } from '@/services/api'
import { SP500_TICKERS, NASDAQ100_TICKERS } from '@/data/sp500'

type TxFilter = 'all' | 'buy' | 'sell'
type IndexFilter = 'all' | 'watchlist' | 'sp500' | 'nasdaq100'

const INDEX_LABELS: Record<IndexFilter, string> = {
  all: 'All',
  watchlist: 'Watchlist',
  sp500: 'S&P 500',
  nasdaq100: 'Nasdaq 100',
}

function isBuy(t: InsiderTrade): boolean {
  const tx = (t.transaction_type ?? '').toUpperCase()
  return tx.startsWith('P') || tx.includes('PURCHASE')
}

function isSell(t: InsiderTrade): boolean {
  const tx = (t.transaction_type ?? '').toUpperCase()
  return tx.startsWith('S') || tx.includes('SALE')
}

function txBadge(t: InsiderTrade) {
  if (isBuy(t)) return { badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', label: 'Buy' }
  if (isSell(t)) return { badgeCls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', label: 'Sell' }
  const raw = t.transaction_type ?? '—'
  return { badgeCls: 'bg-muted text-muted-foreground', label: raw.split('-')[0] || raw }
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s.slice(0, 10)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtNum(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtShares(n: number | null): string {
  if (n === null) return '—'
  return Math.abs(n).toLocaleString()
}

function fmtPrice(n: number | null): string {
  if (n === null) return '—'
  return `$${n.toFixed(2)}`
}

export function InsiderActivityPage() {
  const [txFilter, setTxFilter] = useState<TxFilter>('all')
  const [indexFilter, setIndexFilter] = useState<IndexFilter>('all')
  const [search, setSearch] = useState('')

  // Watchlist
  const { data: portfoliosData } = useQuery({ queryKey: ['portfolios'], queryFn: listPortfolios })
  const firstPortfolioId = portfoliosData?.portfolios?.[0]?.id
  const { data: portfolioDetail } = useQuery({
    queryKey: ['portfolio', firstPortfolioId],
    queryFn: () => getPortfolio(firstPortfolioId!),
    enabled: !!firstPortfolioId,
  })
  const watchlistSet = useMemo(
    () => new Set(portfolioDetail?.holdings?.map(h => h.ticker) ?? []),
    [portfolioDetail],
  )

  const { data: trades = [], isLoading, isError } = useQuery<InsiderTrade[]>({
    queryKey: ['insiderTrades'],
    queryFn: () => getInsiderTrades({ limit: 200 }),
    staleTime: 10 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    let rows = trades
    // Index filter
    if (indexFilter === 'watchlist') rows = rows.filter(r => watchlistSet.has(r.symbol))
    else if (indexFilter === 'sp500') rows = rows.filter(r => SP500_TICKERS.has(r.symbol))
    else if (indexFilter === 'nasdaq100') rows = rows.filter(r => NASDAQ100_TICKERS.has(r.symbol))
    // Transaction type filter
    if (txFilter === 'buy') rows = rows.filter(isBuy)
    if (txFilter === 'sell') rows = rows.filter(isSell)
    // Search
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      rows = rows.filter(
        r => r.symbol?.toUpperCase().includes(q) || r.insider_name?.toUpperCase().includes(q),
      )
    }
    return rows
  }, [trades, txFilter, indexFilter, search, watchlistSet])

  const summary = useMemo(() => {
    const buyVal = filtered.filter(isBuy).reduce((s, t) => s + (t.value ?? 0), 0)
    const sellVal = filtered.filter(isSell).reduce((s, t) => s + (t.value ?? 0), 0)
    const buyCount = filtered.filter(isBuy).length
    const sellCount = filtered.filter(isSell).length
    return { buyVal, sellVal, buyCount, sellCount }
  }, [filtered])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Insider Activity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Open-market buys and sells from recent SEC Form 4 filings · excludes routine awards &amp; grants</p>
      </div>

      {/* Summary cards */}
      {!isLoading && trades.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-1">Insider Buys</div>
            <div className="text-2xl font-bold text-emerald-600">{fmtNum(summary.buyVal)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{summary.buyCount} transactions</div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-1">Insider Sells</div>
            <div className="text-2xl font-bold text-red-500">{fmtNum(summary.sellVal)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{summary.sellCount} transactions</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Index filter */}
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(Object.keys(INDEX_LABELS) as IndexFilter[]).map(k => (
            <button
              key={k}
              onClick={() => setIndexFilter(k)}
              disabled={k === 'watchlist' && watchlistSet.size === 0}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
                indexFilter === k
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {INDEX_LABELS[k]}
              {k === 'watchlist' && watchlistSet.size > 0 && (
                <span className="ml-1 opacity-50">{watchlistSet.size}</span>
              )}
            </button>
          ))}
        </div>

        {/* Buy/Sell filter */}
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['all', 'buy', 'sell'] as TxFilter[]).map(k => (
            <button
              key={k}
              onClick={() => setTxFilter(k)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                txFilter === k
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {k === 'all' ? 'All' : k === 'buy' ? 'Buys' : 'Sells'}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search ticker or insider…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring w-56"
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
          Unable to load insider data.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ticker</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Insider</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Shares</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Price</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    No transactions match your filters.
                  </td>
                </tr>
              )}
              {filtered.map((t, i) => {
                const { badgeCls, label } = txBadge(t)
                const isWL = watchlistSet.has(t.symbol)
                return (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                      {fmtDate(t.transaction_date ?? t.filing_date)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      <div className="flex items-center gap-1.5">
                        <a href={`/research/stock/${t.symbol}`} className="hover:text-primary transition-colors font-semibold">
                          {t.symbol}
                        </a>
                        {isWL && (
                          <span className="text-[9px] px-1 py-0.5 rounded-full bg-primary/15 text-primary font-medium leading-none">WL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-36 truncate text-xs">{t.insider_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-32 truncate">{t.title ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badgeCls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">{fmtShares(t.shares)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">{fmtPrice(t.price)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-xs">{fmtNum(t.value)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
