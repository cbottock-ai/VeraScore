import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listPortfolios,
  getPortfolio,
  createPortfolio,
  deletePortfolio,
  addHolding,
  deleteHolding,
  importCsv,
  exportCsv,
  refreshPortfolio,
} from '@/services/api'
import type { HoldingDetail } from '@/types/portfolio'

// All available columns
const ALL_COLUMNS = [
  { id: 'ticker', label: 'Ticker', align: 'left' as const },
  { id: 'score', label: 'VeraScore', align: 'center' as const },
  { id: 'price', label: 'Last Price', align: 'right' as const },
  { id: 'shares', label: 'Shares', align: 'right' as const },
  { id: 'cost_per_share', label: 'Cost/Share', align: 'right' as const },
  { id: 'day_change_pct', label: '% Change', align: 'right' as const },
  { id: 'market_cap', label: 'Market Cap', align: 'right' as const },
  { id: 'pe_ratio', label: 'NTM P/E', align: 'right' as const },
  { id: 'fcf', label: 'NTM FCF', align: 'right' as const },
  { id: 'value', label: 'Value', align: 'right' as const },
  { id: 'gain_loss', label: 'Gain/Loss', align: 'right' as const },
  { id: 'day_change', label: 'Day Change $', align: 'right' as const },
  { id: 'sector', label: 'Sector', align: 'left' as const },
  { id: 'dividend_yield', label: 'Div Yield', align: 'right' as const },
  { id: 'eps', label: 'EPS', align: 'right' as const },
] as const

// Default visible columns
const DEFAULT_COLUMNS = ['ticker', 'score', 'price', 'shares', 'cost_per_share', 'day_change_pct', 'market_cap', 'pe_ratio', 'fcf']

// Format large numbers (market cap, revenue)
function formatLargeNumber(num: number | null): string {
  if (num === null) return '—'
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
  return `$${num.toLocaleString()}`
}

export function PortfolioPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data } = useQuery({
    queryKey: ['portfolios'],
    queryFn: listPortfolios,
  })

  // Auto-select first watchlist if none selected
  const portfolios = data?.portfolios ?? []
  const activeId = selectedId ?? portfolios[0]?.id ?? null

  return (
    <div>
      {/* Header with watchlist selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Watchlist</h1>
          {portfolios.length > 0 && (
            <select
              value={activeId ?? ''}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <WatchlistActions />
      </div>

      {/* Watchlist content */}
      {activeId ? (
        <WatchlistTable watchlistId={activeId} />
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

// --- Watchlist Actions (Create) ---

function WatchlistActions() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')

  const createMutation = useMutation({
    mutationFn: createPortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      setShowCreate(false)
      setName('')
    },
  })

  return (
    <div className="flex items-center gap-2">
      {showCreate ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) createMutation.mutate({ name: name.trim() })
          }}
          className="flex items-center gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Watchlist name"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => { setShowCreate(false); setName('') }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + New Watchlist
        </button>
      )}
    </div>
  )
}

// --- Watchlist Table ---

function WatchlistTable({ watchlistId }: { watchlistId: number }) {
  const queryClient = useQueryClient()
  const [showAddStock, setShowAddStock] = useState(false)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; columnId: string } | null>(null)

  // Column state with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchlist-columns')
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS
  })

  useEffect(() => {
    localStorage.setItem('watchlist-columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio', watchlistId],
    queryFn: () => getPortfolio(watchlistId),
  })

  const addMutation = useMutation({
    mutationFn: (payload: { ticker: string; shares: number; cost_basis: number }) =>
      addHolding(watchlistId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', watchlistId] })
      setShowAddStock(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', watchlistId] })
      setConfirmDeleteId(null)
    },
  })

  const deleteWatchlistMutation = useMutation({
    mutationFn: deletePortfolio,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolios'] }),
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshPortfolio(watchlistId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio', watchlistId] }),
  })

  const handleExport = async () => {
    const csv = await exportCsv(watchlistId)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `watchlist_${watchlistId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await importCsv(watchlistId, file)
      if (result.errors.length > 0) {
        alert(`Import completed with errors:\n${result.errors.join('\n')}`)
      } else if (result.imported === 0) {
        alert('No stocks were imported. Check your CSV format.')
      }
      queryClient.invalidateQueries({ queryKey: ['portfolio', watchlistId] })
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    e.target.value = ''
  }

  const removeColumn = (columnId: string) => {
    if (columnId === 'ticker') return // Can't remove ticker
    setVisibleColumns(cols => cols.filter(c => c !== columnId))
    setContextMenu(null)
  }

  const addColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      setVisibleColumns(cols => [...cols, columnId])
    }
    setShowColumnPicker(false)
  }

  const handleContextMenu = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    if (columnId === 'ticker') return // Can't remove ticker
    setContextMenu({ x: e.clientX, y: e.clientY, columnId })
  }

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-card animate-pulse" />
  }

  if (!portfolio) {
    return <p className="text-muted-foreground">Watchlist not found.</p>
  }

  const holdings = portfolio.holdings
  const columns = ALL_COLUMNS.filter(c => visibleColumns.includes(c.id))
  const availableColumns = ALL_COLUMNS.filter(c => !visibleColumns.includes(c.id))

  return (
    <div>
      {/* Summary bar */}
      {portfolio.metrics && holdings.length > 0 && (
        <div className="flex items-center gap-6 mb-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Value: </span>
            <span className="font-semibold">${portfolio.metrics.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Gain/Loss: </span>
            <span className={`font-semibold ${portfolio.metrics.total_gain_loss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {portfolio.metrics.total_gain_loss >= 0 ? '+' : ''}${portfolio.metrics.total_gain_loss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {' '}({portfolio.metrics.total_gain_loss_pct >= 0 ? '+' : ''}{portfolio.metrics.total_gain_loss_pct.toFixed(2)}%)
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg Score: </span>
            <span className="font-semibold">{portfolio.metrics.weighted_score?.toFixed(0) ?? '—'}</span>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowAddStock(!showAddStock)}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showAddStock ? 'Cancel' : '+ Add Stock'}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            + Add Column
          </button>
          {showColumnPicker && availableColumns.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
              {availableColumns.map(col => (
                <button
                  key={col.id}
                  onClick={() => addColumn(col.id)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {col.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
        </button>
        <div className="flex-1" />
        <button
          onClick={handleExport}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export
        </button>
        <label className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
          Import
          <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
        </label>
        <button
          onClick={() => {
            if (confirm('Delete this watchlist?')) deleteWatchlistMutation.mutate(watchlistId)
          }}
          className="text-sm text-muted-foreground hover:text-destructive"
        >
          Delete
        </button>
      </div>

      {/* Add stock form */}
      {showAddStock && (
        <AddStockForm onSubmit={(d) => addMutation.mutate(d)} isPending={addMutation.isPending} />
      )}

      {/* Context menu for column removal */}
      {contextMenu && (
        <div
          className="fixed bg-card border border-border rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => removeColumn(contextMenu.columnId)}
            className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-destructive"
          >
            Remove Column
          </button>
        </div>
      )}

      {/* Holdings table - always show headers */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {columns.map(col => (
                <th
                  key={col.id}
                  onContextMenu={(e) => handleContextMenu(e, col.id)}
                  className={`px-4 py-3 font-medium cursor-default select-none ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                  } ${col.id !== 'ticker' ? 'hover:bg-muted/80' : ''}`}
                  title={col.id !== 'ticker' ? 'Right-click to remove' : ''}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-muted-foreground">
                  No stocks yet. Click "+ Add Stock" to get started.
                </td>
              </tr>
            ) : (
              holdings.map((h) => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  columns={columns}
                  isConfirmingDelete={confirmDeleteId === h.id}
                  onConfirmDelete={() => setConfirmDeleteId(h.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onDelete={() => deleteMutation.mutate(h.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Holding Row ---

function HoldingRow({
  holding: h,
  columns,
  isConfirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
}: {
  holding: HoldingDetail
  columns: typeof ALL_COLUMNS[number][]
  isConfirmingDelete: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  const getScoreColor = (score: number | null) => {
    if (score === null) return ''
    if (score >= 70) return 'text-green-500'
    if (score >= 50) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getCellValue = (columnId: string) => {
    const dayPositive = (h.day_change ?? 0) >= 0
    const dayColor = dayPositive ? 'text-green-500' : 'text-red-500'
    const glPositive = (h.gain_loss ?? 0) >= 0
    const glColor = h.gain_loss !== null ? (glPositive ? 'text-green-500' : 'text-red-500') : ''

    switch (columnId) {
      case 'ticker':
        return <span className="font-semibold">{h.ticker}</span>
      case 'score':
        return <span className={`font-semibold ${getScoreColor(h.score)}`}>{h.score?.toFixed(0) ?? '—'}</span>
      case 'price':
        return <span className="font-mono">{h.current_price !== null ? `$${h.current_price.toFixed(2)}` : '—'}</span>
      case 'shares':
        return <span className="font-mono">{h.shares}</span>
      case 'cost_per_share':
        return <span className="font-mono">{h.cost_per_share !== null ? `$${h.cost_per_share.toFixed(2)}` : '—'}</span>
      case 'day_change_pct':
        return (
          <span className={`font-mono ${dayColor}`}>
            {h.day_change_pct !== null ? `${dayPositive ? '+' : ''}${h.day_change_pct.toFixed(2)}%` : '—'}
          </span>
        )
      case 'day_change':
        return (
          <span className={`font-mono ${dayColor}`}>
            {h.day_change !== null ? `${dayPositive ? '+' : ''}$${h.day_change.toFixed(2)}` : '—'}
          </span>
        )
      case 'market_cap':
        return <span className="font-mono text-muted-foreground">{formatLargeNumber(h.market_cap)}</span>
      case 'pe_ratio':
        return <span className="font-mono text-muted-foreground">{h.pe_ratio?.toFixed(1) ?? '—'}</span>
      case 'fcf':
        return <span className="font-mono text-muted-foreground">—</span> // TODO: Add FCF data
      case 'value':
        return <span className="font-mono">{h.current_value !== null ? `$${h.current_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</span>
      case 'gain_loss':
        return (
          <span className={`font-mono ${glColor}`}>
            {h.gain_loss !== null ? (
              <>
                {glPositive ? '+' : ''}${Math.abs(h.gain_loss).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-xs ml-1">({glPositive ? '+' : ''}{h.gain_loss_pct?.toFixed(1) ?? '0.0'}%)</span>
              </>
            ) : '—'}
          </span>
        )
      case 'sector':
        return <span className="text-muted-foreground truncate max-w-[120px]">{h.sector || '—'}</span>
      case 'dividend_yield':
        return <span className="font-mono text-muted-foreground">{h.dividend_yield !== null ? `${h.dividend_yield.toFixed(2)}%` : '—'}</span>
      case 'eps':
        return <span className="font-mono text-muted-foreground">{h.eps !== null ? `$${h.eps.toFixed(2)}` : '—'}</span>
      default:
        return '—'
    }
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30">
      {columns.map(col => (
        <td
          key={col.id}
          className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
        >
          {getCellValue(col.id)}
        </td>
      ))}
      <td className="px-4 py-3">
        {isConfirmingDelete ? (
          <div className="flex gap-1">
            <button onClick={onDelete} className="text-xs text-destructive hover:underline">Yes</button>
            <button onClick={onCancelDelete} className="text-xs text-muted-foreground hover:underline">No</button>
          </div>
        ) : (
          <button
            onClick={onConfirmDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  )
}

// --- Add Stock Form ---

function AddStockForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: { ticker: string; shares: number; cost_basis: number }) => void
  isPending: boolean
}) {
  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [costBasis, setCostBasis] = useState('')

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!ticker.trim() || !shares || !costBasis) return
          onSubmit({
            ticker: ticker.trim().toUpperCase(),
            shares: parseFloat(shares),
            cost_basis: parseFloat(costBasis),
          })
          setTicker('')
          setShares('')
          setCostBasis('')
        }}
        className="flex items-end gap-4"
      >
        <div>
          <label className="text-xs text-muted-foreground">Ticker</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="AAPL"
            className="mt-1 w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Shares</label>
          <input
            type="number"
            step="any"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="100"
            className="mt-1 w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Total Cost ($)</label>
          <input
            type="number"
            step="any"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
            placeholder="15000"
            className="mt-1 w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          type="submit"
          disabled={!ticker.trim() || !shares || !costBasis || isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  )
}

// --- Empty State ---

function EmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-16 text-center">
      <div className="text-4xl mb-4">📋</div>
      <p className="text-muted-foreground mb-2">No watchlists yet</p>
      <p className="text-sm text-muted-foreground">Create a watchlist to start tracking stocks</p>
    </div>
  )
}
