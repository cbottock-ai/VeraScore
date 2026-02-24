import { useState } from 'react'
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
} from '@/services/api'
import type { HoldingDetail, PortfolioMetrics } from '@/types/portfolio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function PortfolioPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  return selectedId ? (
    <PortfolioDetail id={selectedId} onBack={() => setSelectedId(null)} />
  ) : (
    <PortfolioList onSelect={setSelectedId} />
  )
}

// --- Portfolio List ---

function PortfolioList({ onSelect }: { onSelect: (id: number) => void }) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: listPortfolios,
  })

  const createMutation = useMutation({
    mutationFn: createPortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      setShowCreate(false)
      setName('')
      setDescription('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePortfolio,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolios'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Portfolios</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showCreate ? 'Cancel' : 'New Portfolio'}
        </button>
      </div>

      {showCreate && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim()) createMutation.mutate({ name: name.trim(), description: description.trim() || undefined })
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label className="text-sm text-muted-foreground">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Portfolio"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-muted-foreground">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!name.trim() || createMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Create
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : data?.portfolios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No portfolios yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.portfolios.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => onSelect(p.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id)
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {p.description && (
                  <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                )}
                <Badge variant="secondary">{p.holdings_count} holdings</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Portfolio Detail ---

function PortfolioDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [showAddHolding, setShowAddHolding] = useState(false)

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio', id],
    queryFn: () => getPortfolio(id),
  })

  const addMutation = useMutation({
    mutationFn: (payload: { ticker: string; shares: number; cost_basis: number; purchase_date?: string }) =>
      addHolding(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', id] })
      setShowAddHolding(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteHolding,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio', id] }),
  })

  const handleExport = async () => {
    const csv = await exportCsv(id)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio_${id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await importCsv(id, file)
    queryClient.invalidateQueries({ queryKey: ['portfolio', id] })
    e.target.value = ''
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!portfolio) {
    return <p className="text-muted-foreground">Portfolio not found.</p>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back
        </button>
        <h1 className="text-2xl font-semibold">{portfolio.name}</h1>
        {portfolio.description && (
          <span className="text-sm text-muted-foreground">{portfolio.description}</span>
        )}
      </div>

      {/* Metrics Summary */}
      {portfolio.metrics && <MetricsSummary metrics={portfolio.metrics} />}

      {/* Actions */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setShowAddHolding(!showAddHolding)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showAddHolding ? 'Cancel' : 'Add Holding'}
        </button>
        <button
          onClick={handleExport}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export CSV
        </button>
        <label className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
          Import CSV
          <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
        </label>
      </div>

      {/* Add Holding Form */}
      {showAddHolding && <AddHoldingForm onSubmit={(d) => addMutation.mutate(d)} isPending={addMutation.isPending} />}

      {/* Holdings Table */}
      <HoldingsTable
        holdings={portfolio.holdings}
        onDelete={(holdingId) => {
          if (confirm('Remove this holding?')) deleteMutation.mutate(holdingId)
        }}
      />
    </div>
  )
}

// --- Metrics Summary Cards ---

function MetricsSummary({ metrics }: { metrics: PortfolioMetrics }) {
  const glColor = metrics.total_gain_loss >= 0 ? 'text-green-500' : 'text-red-500'

  return (
    <div className="grid gap-4 mb-6 grid-cols-2 md:grid-cols-4">
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-xl font-semibold font-mono">${metrics.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="text-xl font-semibold font-mono">${metrics.total_cost_basis.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Gain/Loss</p>
          <p className={`text-xl font-semibold font-mono ${glColor}`}>
            {metrics.total_gain_loss >= 0 ? '+' : ''}${metrics.total_gain_loss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className={`text-xs font-mono ${glColor}`}>
            {metrics.total_gain_loss_pct >= 0 ? '+' : ''}{metrics.total_gain_loss_pct.toFixed(2)}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">VeraScore</p>
          <p className="text-xl font-semibold font-mono">
            {metrics.weighted_score !== null ? metrics.weighted_score.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">{metrics.holdings_count} holdings</p>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Holdings Table ---

function HoldingsTable({
  holdings,
  onDelete,
}: {
  holdings: HoldingDetail[]
  onDelete: (id: number) => void
}) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground">No holdings yet. Add a stock to get started.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left font-medium">Ticker</th>
            <th className="px-4 py-2 text-right font-medium">Shares</th>
            <th className="px-4 py-2 text-right font-medium">Cost Basis</th>
            <th className="px-4 py-2 text-right font-medium">Price</th>
            <th className="px-4 py-2 text-right font-medium">Value</th>
            <th className="px-4 py-2 text-right font-medium">Gain/Loss</th>
            <th className="px-4 py-2 text-right font-medium">Score</th>
            <th className="px-4 py-2 text-left font-medium">Sector</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const glColor =
              h.gain_loss !== null ? (h.gain_loss >= 0 ? 'text-green-500' : 'text-red-500') : ''
            return (
              <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{h.ticker}</td>
                <td className="px-4 py-2 text-right font-mono">{h.shares}</td>
                <td className="px-4 py-2 text-right font-mono">${h.cost_basis.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {h.current_price !== null ? `$${h.current_price.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {h.current_value !== null ? `$${h.current_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                </td>
                <td className={`px-4 py-2 text-right font-mono ${glColor}`}>
                  {h.gain_loss !== null ? (
                    <>
                      {h.gain_loss >= 0 ? '+' : ''}${h.gain_loss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      {h.gain_loss_pct !== null && (
                        <span className="ml-1 text-xs">({h.gain_loss_pct >= 0 ? '+' : ''}{h.gain_loss_pct.toFixed(1)}%)</span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {h.score !== null ? h.score.toFixed(1) : '—'}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{h.sector || '—'}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => onDelete(h.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Add Holding Form ---

function AddHoldingForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: { ticker: string; shares: number; cost_basis: number; purchase_date?: string }) => void
  isPending: boolean
}) {
  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [costBasis, setCostBasis] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!ticker.trim() || !shares || !costBasis) return
            onSubmit({
              ticker: ticker.trim().toUpperCase(),
              shares: parseFloat(shares),
              cost_basis: parseFloat(costBasis),
              purchase_date: purchaseDate || undefined,
            })
            setTicker('')
            setShares('')
            setCostBasis('')
            setPurchaseDate('')
          }}
          className="flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="text-sm text-muted-foreground">Ticker</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="AAPL"
              className="mt-1 w-24 rounded-md border border-border bg-background px-3 py-2 text-sm uppercase"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Shares</label>
            <input
              type="number"
              step="any"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="100"
              className="mt-1 w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Total Cost</label>
            <input
              type="number"
              step="any"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
              placeholder="15000"
              className="mt-1 w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="mt-1 w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!ticker.trim() || !shares || !costBasis || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
