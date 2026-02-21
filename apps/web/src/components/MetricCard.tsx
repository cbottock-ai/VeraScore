import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface MetricItem {
  label: string
  value: number | string | null
  format?: 'number' | 'percent' | 'ratio' | 'currency' | 'compact' | 'raw'
}

interface MetricCardProps {
  title: string
  metrics: MetricItem[]
}

function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString()}`
}

function formatValue(value: number | string | null, format: MetricItem['format'] = 'number'): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  switch (format) {
    case 'percent':
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
    case 'ratio':
      return value.toFixed(2)
    case 'currency':
      return `$${value.toFixed(2)}`
    case 'compact':
      return formatCompact(value)
    case 'raw':
      return String(value)
    default:
      return value.toFixed(2)
  }
}

export function MetricCard({ title, metrics }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-mono font-medium">{formatValue(m.value, m.format)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
