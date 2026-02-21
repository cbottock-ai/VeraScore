import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FactorScore } from '@/types/stock'

function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-500'
  if (score >= 65) return 'text-emerald-400'
  if (score >= 50) return 'text-yellow-500'
  if (score >= 35) return 'text-orange-500'
  return 'text-red-500'
}

function scoreBgColor(score: number | null): string {
  if (score === null) return 'bg-muted'
  if (score >= 80) return 'bg-green-500/10'
  if (score >= 65) return 'bg-emerald-400/10'
  if (score >= 50) return 'bg-yellow-500/10'
  if (score >= 35) return 'bg-orange-500/10'
  return 'bg-red-500/10'
}

function scoreLabel(score: number | null): string {
  if (score === null) return '—'
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Strong'
  if (score >= 50) return 'Moderate'
  if (score >= 35) return 'Below Avg'
  return 'Weak'
}

interface ScoreBadgeProps {
  score: number | null
  label: string
  size?: 'sm' | 'lg'
}

export function ScoreBadge({ score, label, size = 'sm' }: ScoreBadgeProps) {
  const isLarge = size === 'lg'
  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg p-3 ${scoreBgColor(score)}`}>
      <span className={`font-mono font-bold ${scoreColor(score)} ${isLarge ? 'text-4xl' : 'text-2xl'}`}>
        {score !== null ? Math.round(score) : '—'}
      </span>
      <span className={`text-muted-foreground ${isLarge ? 'text-sm' : 'text-xs'}`}>{label}</span>
      <span className={`text-xs font-medium ${scoreColor(score)}`}>{scoreLabel(score)}</span>
    </div>
  )
}

interface FactorCardProps {
  factor: FactorScore
}

export function FactorCard({ factor }: FactorCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{factor.label}</CardTitle>
          <span className={`text-lg font-mono font-bold ${scoreColor(factor.score)}`}>
            {factor.score !== null ? Math.round(factor.score) : '—'}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${factor.score !== null && factor.score >= 65 ? 'bg-green-500' : factor.score !== null && factor.score >= 50 ? 'bg-yellow-500' : factor.score !== null && factor.score >= 35 ? 'bg-orange-500' : 'bg-red-500'}`}
            style={{ width: `${factor.score ?? 0}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {factor.components.map((c) => (
          <div key={c.metric_id} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{c.label}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">
                {c.raw_value !== null ? formatRaw(c.raw_value, c.label) : '—'}
              </span>
              <span className={`font-mono font-medium w-8 text-right ${scoreColor(c.score)}`}>
                {c.score !== null ? Math.round(c.score) : '—'}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function formatRaw(value: number, label: string): string {
  const l = label.toLowerCase()
  if (l.includes('margin') || l.includes('growth') || l.includes('yield') || l.includes('roe') || l.includes('roa') || l.includes('change')) {
    return `${value.toFixed(1)}%`
  }
  if (l.includes('ratio') || l.includes('p/e') || l.includes('p/b') || l.includes('p/s') || l.includes('ev/') || l.includes('peg')) {
    return `${value.toFixed(1)}x`
  }
  return value.toFixed(2)
}
