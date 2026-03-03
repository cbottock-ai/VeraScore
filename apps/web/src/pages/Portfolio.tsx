import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  listPortfolios,
  getAvailableColumns,
  getPortfolioDynamic,
  createPortfolio,
  deletePortfolio,
  addHolding,
  deleteHolding,
  importCsv,
  exportCsv,
  refreshPortfolio,
} from '@/services/api'
import type { ColumnDef, PortfolioDynamicResponse } from '@/types/portfolio'

// Default columns to show
const DEFAULT_COLUMNS = [
  'ticker',
  'score',
  'price',
  'shares',
  'cost_per_share',
  'day_change_pct',
  'market_cap',
  'pe_ntm',
  'fcf',
]

// Format value based on column format type
function formatValue(value: unknown, format: ColumnDef['format']): string {
  if (value === null || value === undefined) return '—'

  const num = typeof value === 'number' ? value : parseFloat(String(value))

  switch (format) {
    case 'currency':
      return isNaN(num) ? '—' : `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent':
      if (isNaN(num)) return '—'
      const sign = num >= 0 ? '+' : ''
      return `${sign}${num.toFixed(2)}%`
    case 'large_number':
      if (isNaN(num)) return '—'
      if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
      if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
      if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
      if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
      return `$${num.toLocaleString()}`
    case 'number':
      return isNaN(num) ? '—' : num.toFixed(2)
    case 'ratio':
      return isNaN(num) ? '—' : num.toFixed(2) + 'x'
    case 'days':
      return isNaN(num) ? '—' : num.toFixed(0) + 'd'
    case 'score':
      return isNaN(num) ? '—' : num.toFixed(0)
    default:
      return String(value)
  }
}

// Get color class for values
function getValueColor(value: unknown, format: ColumnDef['format'], columnId: string): string {
  if (value === null || value === undefined) return ''

  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return ''

  // Score coloring
  if (columnId === 'score') {
    if (num >= 70) return 'text-green-500'
    if (num >= 50) return 'text-yellow-500'
    return 'text-red-500'
  }

  // Percent/change coloring
  if (format === 'percent' || columnId.includes('change') || columnId.includes('gain_loss')) {
    return num >= 0 ? 'text-green-500' : 'text-red-500'
  }

  return ''
}

// Get text alignment for format type
function getAlignment(format: ColumnDef['format']): string {
  switch (format) {
    case 'currency':
    case 'percent':
    case 'number':
    case 'large_number':
    case 'score':
      return 'text-right'
    default:
      return 'text-left'
  }
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

// Sort direction type
type SortDirection = 'asc' | 'desc' | null

function WatchlistTable({ watchlistId }: { watchlistId: number }) {
  const queryClient = useQueryClient()
  const [showAddStock, setShowAddStock] = useState(false)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; columnId: string } | null>(null)

  // Sort state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Column state with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchlist-columns')
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS
  })

  useEffect(() => {
    localStorage.setItem('watchlist-columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  // Fetch available columns from API
  const { data: availableColumnsData } = useQuery({
    queryKey: ['portfolio-columns'],
    queryFn: getAvailableColumns,
    staleTime: Infinity, // Column definitions don't change
  })

  const allColumns = availableColumnsData ?? []
  const columnMap = useMemo(() => {
    const map: Record<string, ColumnDef> = {}
    for (const col of allColumns) {
      map[col.id] = col
    }
    return map
  }, [allColumns])

  // Fetch portfolio data with dynamic columns
  const { data: portfolio, isLoading, isFetching } = useQuery({
    queryKey: ['portfolio', watchlistId, visibleColumns],
    queryFn: () => getPortfolioDynamic(watchlistId, visibleColumns),
    enabled: visibleColumns.length > 0,
    placeholderData: keepPreviousData, // Keep showing old data while fetching new columns
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
    mutationFn: () => refreshPortfolio(watchlistId, visibleColumns),
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

  // Handle column header click for sorting
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Cycle: asc -> desc -> none
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(columnId)
      setSortDirection('asc')
    }
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

  const columns = visibleColumns.map(id => columnMap[id]).filter(Boolean)
  const hiddenColumns = allColumns.filter(c => !visibleColumns.includes(c.id))

  // Sort holdings
  const holdings = useMemo(() => {
    if (!sortColumn || !sortDirection) return portfolio.holdings

    return [...portfolio.holdings].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      // Handle nulls - always sort to bottom
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      // Numeric comparison
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal))
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal))

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }

      // String comparison
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      const cmp = aStr.localeCompare(bStr)
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [portfolio.holdings, sortColumn, sortDirection])

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
        <ColumnPicker
          columns={hiddenColumns}
          onSelect={addColumn}
          isOpen={showColumnPicker}
          onToggle={() => setShowColumnPicker(!showColumnPicker)}
        />
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

      {/* Holdings table */}
      <div className={`overflow-x-auto rounded-xl border border-border transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {columns.map(col => {
                const isSorted = sortColumn === col.id
                const isRemovable = col.id !== 'ticker'

                return (
                  <th
                    key={col.id}
                    onClick={() => handleSort(col.id)}
                    onContextMenu={(e) => handleContextMenu(e, col.id)}
                    className={`px-4 py-3 font-medium select-none cursor-pointer group ${getAlignment(col.format)} hover:bg-muted/80`}
                    title={isRemovable ? 'Click to sort · Right-click to remove' : 'Click to sort'}
                  >
                    <div className={`flex items-center gap-1 ${col.format !== 'string' ? 'justify-end' : ''}`}>
                      <span>{col.label}</span>
                      {/* Sort indicator */}
                      <span className={`transition-opacity ${isSorted ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                        {isSorted && sortDirection === 'asc' ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        ) : isSorted && sortDirection === 'desc' ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                          </svg>
                        )}
                      </span>
                      {/* Removable indicator (shows on hover for non-ticker columns) */}
                      {isRemovable && (
                        <span className="opacity-0 group-hover:opacity-40 transition-opacity ml-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
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
                  key={h.id as number}
                  holding={h}
                  columns={columns}
                  isConfirmingDelete={confirmDeleteId === (h.id as number)}
                  onConfirmDelete={() => setConfirmDeleteId(h.id as number)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onDelete={() => deleteMutation.mutate(h.id as number)}
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
  holding,
  columns,
  isConfirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
}: {
  holding: Record<string, unknown>
  columns: ColumnDef[]
  isConfirmingDelete: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30">
      {columns.map(col => {
        const value = holding[col.id]
        const formatted = formatValue(value, col.format)
        const colorClass = getValueColor(value, col.format, col.id)

        return (
          <td
            key={col.id}
            className={`px-4 py-3 font-mono ${getAlignment(col.format)} ${colorClass}`}
          >
            {col.id === 'ticker' ? (
              <span className="font-semibold font-sans">{formatted}</span>
            ) : (
              formatted
            )}
          </td>
        )
      })}
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

// --- Column Picker ---

// Category order for display
const CATEGORY_ORDER = [
  'Position',
  'Price',
  'Company',
  'Valuation',
  'Per Share',
  'Profitability',
  'Growth (YoY)',
  'Growth (3Y CAGR)',
  'Growth (5Y CAGR)',
  'Growth (10Y CAGR)',
  'Liquidity',
  'Leverage',
  'Efficiency',
  'Cash Flow',
  'Dividend',
  'Other',
  'Analyst',
]

function ColumnPicker({
  columns,
  onSelect,
  isOpen,
  onToggle,
}: {
  columns: ColumnDef[]
  onSelect: (columnId: string) => void
  isOpen: boolean
  onToggle: () => void
}) {
  const [search, setSearch] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearch('')
      setExpandedCategory(null)
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onToggle()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  // Filter columns by search (context search: matches label, id, category, description)
  const filteredColumns = useMemo(() => {
    if (!search.trim()) return columns
    const query = search.toLowerCase()
    return columns.filter(col =>
      col.label.toLowerCase().includes(query) ||
      col.id.toLowerCase().includes(query) ||
      col.category.toLowerCase().includes(query) ||
      (col.description && col.description.toLowerCase().includes(query))
    )
  }, [columns, search])

  // Group by category
  const groupedColumns = useMemo(() => {
    const groups: Record<string, ColumnDef[]> = {}
    for (const col of filteredColumns) {
      const cat = col.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(col)
    }
    return groups
  }, [filteredColumns])

  // Sort categories by predefined order
  const sortedCategories = useMemo(() => {
    return Object.keys(groupedColumns).sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(a)
      const bIdx = CATEGORY_ORDER.indexOf(b)
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })
  }, [groupedColumns])

  const handleSelect = (columnId: string) => {
    onSelect(columnId)
    setSearch('')
    setExpandedCategory(null)
  }

  const isSearching = search.trim().length > 0

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={onToggle}
        className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        + Add Column
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 w-72">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search columns..."
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Column list */}
          <div className="max-h-[400px] overflow-y-auto">
            {filteredColumns.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No columns match "{search}"
              </div>
            ) : isSearching ? (
              // Flat list when searching
              <div className="py-1">
                {filteredColumns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => handleSelect(col.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex flex-col"
                  >
                    <span>{col.label}</span>
                    <span className="text-xs text-muted-foreground">{col.category}</span>
                  </button>
                ))}
              </div>
            ) : (
              // Categorized accordion when not searching
              <div className="py-1">
                {sortedCategories.map(category => {
                  const cols = groupedColumns[category]
                  const isExpanded = expandedCategory === category

                  return (
                    <div key={category}>
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : category)}
                        className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted flex items-center justify-between"
                      >
                        <span>{category}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{cols.length}</span>
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="bg-muted/30">
                          {cols.map(col => (
                            <button
                              key={col.id}
                              onClick={() => handleSelect(col.id)}
                              className="w-full text-left px-6 py-1.5 text-sm hover:bg-muted"
                              title={col.description || col.id}
                            >
                              {col.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
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
