import { PLANNING_SURFACES } from '@/lib/planning/planningSurfaces'
import { PlanningSurfaceNav } from '@/app/(dashboard)/_components/PlanningSurfaceNav'

const projectionsSurface = PLANNING_SURFACES.find((s) => s.id === 'projections')!

export function ProjectionsHeader() {
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Projections</h1>
          <p className="mt-1 text-sm text-neutral-600 max-w-xl">
            {projectionsSurface.description} Based on your profile, income, expenses, and assets.
          </p>
        </div>
        <PlanningSurfaceNav className="sm:pt-1" />
      </div>
    </div>
  )
}
