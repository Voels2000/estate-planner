import type { HouseholdProjectionProfile } from '@/lib/projections/types'

type ProjectionAssumptionsProps = {
  household: HouseholdProjectionProfile
}

export function ProjectionAssumptions({ household }: ProjectionAssumptionsProps) {
  return (
    <div className="mb-6 rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">Projection Assumptions</h2>
      <div className="flex flex-wrap gap-6 items-end">
        <div>
          <p className="mb-1 block text-xs font-medium text-neutral-500">Accumulation Growth Rate</p>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
            {(household.growth_rate_accumulation ?? 7).toFixed(1)}%
          </div>
        </div>
        <div>
          <p className="mb-1 block text-xs font-medium text-neutral-500">Retirement Growth Rate</p>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
            {(household.growth_rate_retirement ?? 5).toFixed(1)}%
          </div>
        </div>
        <p className="pb-2 text-xs text-neutral-500">
          This projection is based on growth assumptions from your profile.
        </p>
      </div>
    </div>
  )
}
