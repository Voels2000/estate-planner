import type { HouseholdProjectionProfile } from '@/lib/projections/types'
import { parseGrowthAssumptions } from '@/lib/types/growthAssumptions'
import { GrowthAssumptionInputs } from '@/components/projections/GrowthAssumptionInputs'

type ProjectionAssumptionsProps = {
  household: HouseholdProjectionProfile & {
    growth_assumptions?: unknown
  }
  hasRealEstate?: boolean
  hasBusiness?: boolean
}

export function ProjectionAssumptions({
  household,
  hasRealEstate = true,
  hasBusiness = true,
}: ProjectionAssumptionsProps) {
  const growth = parseGrowthAssumptions(household.growth_assumptions)

  return (
    <div className="mb-6 rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">Projection Assumptions</h2>
      <GrowthAssumptionInputs
        financialAccumulation={household.growth_rate_accumulation ?? 7}
        financialRetirement={household.growth_rate_retirement ?? 5}
        realEstate={growth.real_estate}
        business={growth.business}
        onChange={() => {}}
        readOnly
        showRealEstateInput={hasRealEstate}
        showBusinessInput={hasBusiness}
      />
      <p className="mt-3 text-xs text-neutral-500">
        Edit these on the{' '}
        <a href="/scenarios" className="text-[color:var(--mwm-navy)] underline">
          Scenarios
        </a>{' '}
        page. Financial accumulation and retirement rates can also be updated in your profile.
      </p>
    </div>
  )
}
