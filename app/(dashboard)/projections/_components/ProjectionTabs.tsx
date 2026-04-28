import { BarChart } from '@/app/(dashboard)/projections/_components/BarChart'
import { ProjectionTable } from '@/app/(dashboard)/projections/_components/ProjectionTable'
import { IncomeTable } from '@/app/(dashboard)/projections/_components/IncomeTable'
import type { ProjectionYear } from '@/lib/projections/types'

type ProjectionTab = 'chart' | 'table' | 'income'

type ProjectionTabsProps = {
  activeTab: ProjectionTab
  onTabChange: (tab: ProjectionTab) => void
  projections: ProjectionYear[]
  peakNetWorth: number
  p1: string
  p2: string | null
}

export function ProjectionTabs({
  activeTab,
  onTabChange,
  projections,
  peakNetWorth,
  p1,
  p2,
}: ProjectionTabsProps) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
      <div className="flex border-bder-neutral-200 px-4 pt-4 gap-1">
        {(['chart', 'table', 'income'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${
              activeTab === tab ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab === 'income' ? 'Income Detail' : tab}
          </button>
        ))}
      </div>
      <div className="p-4">
        {activeTab === 'chart' && <BarChart projections={projections} peak={peakNetWorth} />}
        {activeTab === 'table' && <ProjectionTable projections={projections} />}
        {activeTab === 'income' && <IncomeTable projections={projections} p1={p1} p2={p2} />}
      </div>
    </div>
  )
}
