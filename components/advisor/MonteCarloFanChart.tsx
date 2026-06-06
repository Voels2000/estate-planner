'use client'

import { memo, useMemo } from 'react'
import type { FanChartDataPoint } from '@/lib/calculations/estate-monte-carlo'

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

type MonteCarloFanChartProps = {
  data: FanChartDataPoint[]
}

function MonteCarloFanChartInner({ data }: MonteCarloFanChartProps) {
  const chart = useMemo(() => {
    if (!data.length) return null

    const width = 600
    const height = 280
    const padding = { top: 20, right: 20, bottom: 40, left: 80 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom

    const maxVal = Math.max(...data.map((d) => d.p90))
    const minVal = 0
    const range = maxVal - minVal || 1

    const xScale = (i: number) =>
      padding.left + (data.length <= 1 ? chartW / 2 : (i / (data.length - 1)) * chartW)
    const yScale = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH

    const pathD = (key: 'p10' | 'p25' | 'p50' | 'p75' | 'p90') =>
      data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d[key])}`).join(' ')

    const bandPath = [
      ...data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.p90)}`),
      ...data.map(
        (d, i) => `L${xScale(data.length - 1 - i)},${yScale(data[data.length - 1 - i].p10)}`,
      ),
      'Z',
    ].join(' ')

    const bandInner = [
      ...data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.p75)}`),
      ...data.map(
        (d, i) => `L${xScale(data.length - 1 - i)},${yScale(data[data.length - 1 - i].p25)}`,
      ),
      'Z',
    ].join(' ')

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      value: minVal + t * range,
      y: padding.top + chartH - t * chartH,
    }))

    return { width, height, padding, chartW, pathD, bandPath, bandInner, yTicks, xScale, data }
  }, [data])

  if (!chart) return null

  const { width, height, padding, chartW, pathD, bandPath, bandInner, yTicks, xScale } = chart

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <path d={bandPath} fill="#3b82f6" fillOpacity="0.15" />
      <path d={bandInner} fill="#3b82f6" fillOpacity="0.25" />
      <path d={pathD('p50')} fill="none" stroke="#2563eb" strokeWidth="2" />
      <path d={pathD('p10')} fill="none" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 2" />
      <path d={pathD('p90')} fill="none" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 2" />

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
          <text x={padding.left - 8} y={t.y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
            {fmtK(t.value)}
          </text>
        </g>
      ))}

      {chart.data
        .filter((_, i) => i % 5 === 0)
        .map((d, i) => {
          const origIdx = chart.data.findIndex((x) => x.year === d.year)
          return (
            <text
              key={i}
              x={xScale(origIdx)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
            >
              {d.year}
            </text>
          )
        })}

      <g transform={`translate(${padding.left + chartW - 120}, ${padding.top})`}>
        <rect width="12" height="4" y="4" fill="#3b82f6" fillOpacity="0.4" />
        <text x="16" y="10" fontSize="9" fill="#6b7280">
          P25–P75 range
        </text>
        <line x1="0" y1="22" x2="12" y2="22" stroke="#2563eb" strokeWidth="2" />
        <text x="16" y="26" fontSize="9" fill="#6b7280">
          P50 median
        </text>
      </g>
    </svg>
  )
}

export const MonteCarloFanChart = memo(MonteCarloFanChartInner)
