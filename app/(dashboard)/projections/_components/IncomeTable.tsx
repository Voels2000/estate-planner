import type { ProjectionYear } from '@/lib/projections/types'
import { formatDollars } from '@/app/(dashboard)/projections/_utils'

type IncomeTableProps = {
  projections: ProjectionYear[]
  p1: string
  p2: string | null
}

export function IncomeTable({ projections, p1, p2 }: IncomeTableProps) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <th className="pb-2 pr-4">Age</th>
            <th className="pb-2 pr-4">Year</th>
            <th className="pb-2 pr-3 text-blue-600">{p1} Earned</th>
            <th className="pb-2 pr-3 text-blue-600">{p1} SS</th>
            <th className="pb-2 pr-3 text-blue-600">{p1} RMD</th>
            <th className="pb-2 pr-3 text-blue-600">{p1} Other</th>
            {p2 && (
              <>
                <th className="pb-2 pr-3 text-violet-600">{p2} Earned</th>
                <th className="pb-2 pr-3 text-violet-600">{p2} SS</th>
                <th className="pb-2 pr-3 text-violet-600">{p2} RMD</th>
                <th className="pb-2 pr-3 text-violet-600">{p2} Other</th>
              </>
            )}
            <th className="pb-2 pr-4">Joint/Other</th>
            <th className="pb-2">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {projections.map((p) => (
            <tr key={p.age} className={p.phase === 'retirement' ? 'bg-orange-50/50' : ''}>
              <td className="py-1.5 pr-4 font-medium text-neutral-800">{p.age}</td>
              <td className="py-1.5 pr-4 text-neutral-500">{p.year}</td>
              <td className="py-1.5 pr-3 text-blue-700">{formatDollars(p.income_earned_p1)}</td>
              <td className="py-1.5 pr-3 text-blue-700">{formatDollars(p.income_ss_person1)}</td>
              <td className="py-1.5 pr-3 text-blue-700">{formatDollars(p.income_rmd_p1)}</td>
              <td className="py-1.5 pr-3 text-blue-700">{formatDollars(p.income_other_p1)}</td>
              {p2 && (
                <>
                  <td className="py-1.5 pr-3 text-violet-700">{formatDollars(p.income_earned_p2)}</td>
                  <td className="py-1.5 pr-3 text-violet-700">{formatDollars(p.income_ss_person2)}</td>
                  <td className="py-1.5 pr-3 text-violet-700">{formatDollars(p.income_rmd_p2)}</td>
                  <td className="py-1.5 pr-3 text-violet-700">{formatDollars(p.income_other_p2)}</td>
                </>
              )}
              <td className="py-1.5 pr-4 text-neutral-500">{formatDollars(p.income_other_pooled)}</td>
              <td className="py-1.5 font-semibold text-green-600">{formatDollars(p.income)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
