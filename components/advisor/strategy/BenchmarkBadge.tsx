import { getPercentileLabel, type BenchmarkRange } from '@/lib/advisor/benchmarks'

interface BenchmarkBadgeProps {
  value: number
  range: BenchmarkRange
}

export function BenchmarkBadge({ value, range }: BenchmarkBadgeProps) {
  const position = getPercentileLabel(value, range)

  const config = {
    bottom: { label: 'Below median peers', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    middle: { label: 'Near peer median', color: 'text-gray-600 bg-gray-50 border-gray-200' },
    top: { label: 'Above peer median', color: 'text-green-700 bg-green-50 border-green-200' },
  }[position]

  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${config.color}`}
      title={`Peer group: ${range.label} | P25: ${range.p25} · P50: ${range.p50} · P75: ${range.p75}`}
    >
      {config.label}
    </span>
  )
}
