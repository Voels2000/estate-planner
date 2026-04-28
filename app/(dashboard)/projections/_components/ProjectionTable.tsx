import type { ProjectionYear } from '@/lib/projections/types'
import { formatDollars } from '@/app/(dashboard)/projections/_utils'

type ProjectionTableProps = {
  projections: ProjectionYear[]
}

export function ProjectionTable({ projections }: ProjectionTableProps) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <th className="pb-2 pr-4">Age</th>
            <th className="pb-2 pr-4">Year</th>
            <th className="pb-2 pr-4">Income</th>
            <th className="pb-2 pr-4">Expenses</th>
            <th className="pb-2 pr-4">Taxes</th>
            <th className="pb-2 pr-4">Net</th>
            <th className="pb-2 pr-4">Portfolio</th>
            <th className="pb-2">Net Worth</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {projections.map((p) => (
            <tr key={p.age} className={p.phase === 'retirement' ? 'bg-orange-50/50' : ''}>
              <td className="py-1.5 pr-4 font-medium text-neutral-800">{p.age}</td>
              <td className="py-1.5 pr-4 text-neutral-500">{p.year}</td>
              <td className="py-1.5 pr-4 text-green-600">{formatDollars(p.income)}</td>
              <td className="py-1.5 pr-4 text-red-500">{formatDollars(p.expenses)}</td>
              <td className="py-1.5 pr-4 text-amber-600">{formatDollars(p.taxes)}</td>
              <td className={`py-1.5 pr-4 font-medium ${p.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {p.net >= 0 ? '+' : ''}
                {formatDollars(p.net)}
              </td>
              <td className={`py-1.5 pr-4 font-semibold ${p.portfolio < 1000 ? 'text-red-600' : 'text-neutral-900'}`}>
                {formatDollars(p.portfolio)}
              </td>
              <td className={`py-1.5 font-semibold ${p.net_worth < 1000 ? 'text-red-600' : 'text-indigo-700'}`}>
                {formatDollars(p.net_worth)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
