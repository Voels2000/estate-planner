import type { PercentileByYear } from '@/lib/calculations/estate-monte-carlo'

export interface EstateOutlookChartProps {
  bands: PercentileByYear[]
  className?: string
}

function fmtMillions(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

export function EstateOutlookChart({ bands, className }: EstateOutlookChartProps) {
  if (!bands.length) return null

  const width = 600
  const height = 200
  const padding = { top: 16, right: 16, bottom: 32, left: 48 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const maxVal = Math.max(...bands.map((d) => d.p90_gross))
  const minVal = 0
  const range = maxVal - minVal || 1

  const xScale = (i: number) =>
    padding.left + (bands.length <= 1 ? chartW / 2 : (i / (bands.length - 1)) * chartW)
  const yScale = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH

  const pathD = (key: 'p10_gross' | 'p25_gross' | 'p50_gross' | 'p75_gross' | 'p90_gross') =>
    bands.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d[key])}`).join(' ')

  const bandPath = [
    ...bands.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.p90_gross)}`),
    ...bands.map(
      (d, i) => `L${xScale(bands.length - 1 - i)},${yScale(bands[bands.length - 1 - i].p10_gross)}`,
    ),
    'Z',
  ].join(' ')

  const bandInner = [
    ...bands.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.p75_gross)}`),
    ...bands.map(
      (d, i) => `L${xScale(bands.length - 1 - i)},${yScale(bands[bands.length - 1 - i].p25_gross)}`,
    ),
    'Z',
  ].join(' ')

  const yTicks = [
    { value: minVal, y: yScale(minVal) },
    { value: minVal + range / 2, y: yScale(minVal + range / 2) },
    { value: maxVal, y: yScale(maxVal) },
  ]

  const xLabelIndices = [0, Math.floor((bands.length - 1) / 2), bands.length - 1]

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-label="Estate outlook fan chart">
        <path d={bandPath} fill="#3b82f6" fillOpacity="0.15" />
        <path d={bandInner} fill="#3b82f6" fillOpacity="0.25" />
        <path d={pathD('p50_gross')} fill="none" stroke="#2563eb" strokeWidth="2" />
        <path
          d={pathD('p10_gross')}
          fill="none"
          stroke="#93c5fd"
          strokeWidth="1"
          strokeDasharray="4 2"
        />
        <path
          d={pathD('p90_gross')}
          fill="none"
          stroke="#93c5fd"
          strokeWidth="1"
          strokeDasharray="4 2"
        />

        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={t.y}
              x2={padding.left + chartW}
              y2={t.y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text x={padding.left - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
              {fmtMillions(t.value)}
            </text>
          </g>
        ))}

        {xLabelIndices.map((idx) => {
          const d = bands[idx]
          if (!d) return null
          return (
            <text
              key={idx}
              x={xScale(idx)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
            >
              {d.year} (age {d.age_p1})
            </text>
          )
        })}
      </svg>

      <div className="mt-2 flex items-center gap-4 text-xs text-[--mwm-text-muted]">
        <span>── P50 median</span>
        <span>░░ P25–P75 range</span>
        <span>╌╌ P10 / P90</span>
      </div>
    </div>
  )
}
