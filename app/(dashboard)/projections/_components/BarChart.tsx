import type { ProjectionYear } from '@/lib/projections/types'
import { formatDollars } from '@/app/(dashboard)/projections/_utils'

type BarChartProps = {
  projections: ProjectionYear[]
  peak: number
}

export function BarChart({ projections, peak }: BarChartProps) {
  const step = projections.length > 40 ? 5 : projections.length > 25 ? 2 : 1
  const sampled = projections.filter((_, i) => i % step === 0)

  return (
    <div className="flex items-end gap-0.5 h-56 w-full px-2">
      {sampled.map((p) => {
        const pct = peak > 0 ? (p.net_worth / peak) * 100 : 0
        return (
          <div key={p.age} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex items-end" style={{ height: '200px' }}>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg">
                Age {p.age}: {formatDollars(p.net_worth)}
              </div>
              <div
                className={`w-full rounded-t transition-all ${
                  p.phase === 'retirement'
                    ? p.net_worth < peak * 0.1
                      ? 'bg-red-400'
                      : 'bg-orange-400'
                    : 'bg-neutral-700'
                }`}
                style={{ height: `${Math.max(pct, 1)}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-400">{p.age}</span>
          </div>
        )
      })}
    </div>
  )
}
