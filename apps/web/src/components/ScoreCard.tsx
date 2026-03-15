import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FactorScore } from '@/types/stock'

// Score colour helpers
function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-500'
  if (score >= 65) return 'text-emerald-400'
  if (score >= 50) return 'text-yellow-500'
  if (score >= 35) return 'text-orange-500'
  return 'text-red-500'
}

function scoreHex(score: number | null): string {
  if (score === null) return '#94a3b8'
  if (score >= 80) return '#22c55e'
  if (score >= 65) return '#34d399'
  if (score >= 50) return '#eab308'
  if (score >= 35) return '#f97316'
  return '#ef4444'
}

function scoreTrackHex(): string {
  return '#334155'
}

function scoreLabel(score: number | null): string {
  if (score === null) return '—'
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Strong'
  if (score >= 50) return 'Moderate'
  if (score >= 35) return 'Below Avg'
  return 'Weak'
}

// ─── Score Gauge (SVG arc) ────────────────────────────────────────────────────

interface ScoreGaugeProps {
  score: number | null
  label?: string
  size?: 'sm' | 'lg'
}

export function ScoreGauge({ score, label, size = 'lg' }: ScoreGaugeProps) {
  const cx = 70, cy = 68, r = 54
  const pct = Math.max(0.005, Math.min(1, (score ?? 0) / 100))
  const angle = (1 - pct) * Math.PI
  const px = cx + r * Math.cos(angle)
  const py = cy - r * Math.sin(angle)
  const largeArc = pct >= 0.5 ? 1 : 0
  const startX = cx - r
  const endX = cx + r
  const trackY = cy

  const color = scoreHex(score)
  const track = scoreTrackHex()
  const isLg = size === 'lg'

  return (
    <div className={`flex flex-col items-center ${isLg ? 'w-44' : 'w-28'}`}>
      <svg viewBox="0 0 140 90" className="w-full" aria-label={`Score: ${score ?? 'N/A'}`}>
        {/* Background arc */}
        <path
          d={`M ${startX} ${trackY} A ${r} ${r} 0 1 1 ${endX} ${trackY}`}
          fill="none"
          stroke={track}
          strokeWidth={isLg ? 9 : 7}
          strokeLinecap="round"
        />
        {/* Score arc */}
        {score !== null && (
          <path
            d={`M ${startX} ${trackY} A ${r} ${r} 0 ${largeArc} 1 ${px} ${py}`}
            fill="none"
            stroke={color}
            strokeWidth={isLg ? 9 : 7}
            strokeLinecap="round"
          />
        )}
        {/* Score number */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={isLg ? 26 : 18}
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
          fill={color}
        >
          {score !== null ? Math.round(score) : '—'}
        </text>
        {/* Rating label */}
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={isLg ? 11 : 9}
          fill="#94a3b8"
        >
          {scoreLabel(score)}
        </text>
      </svg>
      {label && (
        <span className="text-xs text-muted-foreground -mt-1">{label}</span>
      )}
    </div>
  )
}

// ─── Score Badge (compact, for factor summaries) ──────────────────────────────

interface ScoreBadgeProps {
  score: number | null
  label: string
  size?: 'sm' | 'lg'
}

export function ScoreBadge({ score, label, size = 'sm' }: ScoreBadgeProps) {
  if (size === 'lg') return <ScoreGauge score={score} label={label} size="lg" />

  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 bg-card border border-border min-w-[72px]">
      <span className={`font-mono font-bold text-xl leading-none ${scoreColor(score)}`}>
        {score !== null ? Math.round(score) : '—'}
      </span>
      <span className="text-[10px] text-muted-foreground leading-tight text-center">{label}</span>
    </div>
  )
}

// ─── Factor Bar (horizontal bar with label + score) ───────────────────────────

interface FactorBarProps {
  factor: FactorScore
}

export function FactorBar({ factor }: FactorBarProps) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = requestAnimationFrame(() => setWidth(factor.score ?? 0))
    return () => cancelAnimationFrame(t)
  }, [factor.score])

  const color = scoreHex(factor.score)

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-muted-foreground w-28 shrink-0">{factor.label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-sm font-semibold w-8 text-right" style={{ color }}>
        {factor.score !== null ? Math.round(factor.score) : '—'}
      </span>
    </div>
  )
}

// ─── Factor Card (detailed breakdown) ────────────────────────────────────────

interface FactorCardProps {
  factor: FactorScore
}

export function FactorCard({ factor }: FactorCardProps) {
  const [barWidth, setBarWidth] = useState(0)

  useEffect(() => {
    const t = requestAnimationFrame(() => setBarWidth(factor.score ?? 0))
    return () => cancelAnimationFrame(t)
  }, [factor.score])

  const barColor =
    factor.score !== null && factor.score >= 65 ? 'bg-green-500'
    : factor.score !== null && factor.score >= 50 ? 'bg-yellow-500'
    : factor.score !== null && factor.score >= 35 ? 'bg-orange-500'
    : 'bg-red-500'

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{factor.label}</CardTitle>
          <span className={`text-xl font-mono font-bold ${scoreColor(factor.score)}`}>
            {factor.score !== null ? Math.round(factor.score) : '—'}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-4">
        {factor.components.map((c) => (
          <div key={c.metric_id} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate mr-2">{c.label}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-muted-foreground">
                {c.raw_value !== null ? formatRaw(c.raw_value, c.label) : '—'}
              </span>
              <span className={`font-mono font-semibold w-7 text-right ${scoreColor(c.score)}`}>
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
  if (l.includes('margin') || l.includes('growth') || l.includes('yield') || l.includes('roe') || l.includes('roa') || l.includes('rate') || l.includes('streak')) {
    if (l.includes('streak')) return `${value}q`
    return `${value > 0 && l.includes('growth') ? '+' : ''}${value.toFixed(1)}%`
  }
  if (l.includes('ratio') || l.includes('p/e') || l.includes('p/b') || l.includes('p/s') || l.includes('ev/') || l.includes('peg')) {
    return `${value.toFixed(1)}x`
  }
  if (l.includes('tone') || l.includes('beat') || l.includes('surprise')) {
    return `${value.toFixed(0)}`
  }
  return value.toFixed(2)
}
