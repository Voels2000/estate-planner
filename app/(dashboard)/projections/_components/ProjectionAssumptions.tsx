import Link from 'next/link'
import type { HouseholdProjectionProfile } from '@/lib/projections/types'
import { parseGrowthAssumptions } from '@/lib/types/growthAssumptions'

type ProjectionAssumptionsProps = {
  household: HouseholdProjectionProfile & {
    growth_assumptions?: unknown
    inflation_rate?: number | null
  }
  hasRealEstate?: boolean
  hasBusiness?: boolean
}

function AssumptionRow({
  label,
  value,
  source,
  href,
}: {
  label: string
  value: string
  source: string
  href: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-medium text-[#0F1B3C]">{value}/yr</span>
        <Link href={href} className="text-[10px] text-gray-300 hover:text-[#C9A84C]">
          ({source})
        </Link>
      </div>
    </div>
  )
}

export function ProjectionAssumptions({
  household,
  hasRealEstate = true,
  hasBusiness = true,
}: ProjectionAssumptionsProps) {
  const growth = parseGrowthAssumptions(household.growth_assumptions)
  const accum = household.growth_rate_accumulation ?? 7
  const retire = household.growth_rate_retirement ?? 5
  const inflation = household.inflation_rate ?? 2.5

  return (
    <div className="mb-6 rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
      <div className="text-xs text-gray-500">
        <p className="font-semibold text-[#0F1B3C] mb-2">Projection Assumptions</p>
        <div className="space-y-1">
          <AssumptionRow
            label="Financial (accumulation)"
            value={`${accum}%`}
            source="Scenarios"
            href="/scenarios"
          />
          <AssumptionRow
            label="Financial (retirement)"
            value={`${retire}%`}
            source="Scenarios"
            href="/scenarios"
          />
          {hasRealEstate && (
            <AssumptionRow
              label="Real estate"
              value={`${growth.real_estate}%`}
              source="Scenarios"
              href="/scenarios"
            />
          )}
          {hasBusiness && (
            <AssumptionRow
              label="Business interests"
              value={`${growth.business}%`}
              source="Scenarios"
              href="/scenarios"
            />
          )}
          <AssumptionRow
            label="Inflation"
            value={`${inflation}%`}
            source="Scenarios"
            href="/scenarios"
          />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
        Portfolio growth rates apply to financial assets only. Real estate and business use
        separate rates. Edit all assumptions on the{' '}
        <Link href="/scenarios" className="text-[color:var(--mwm-navy)] underline">
          Scenarios
        </Link>{' '}
        page.
      </p>
    </div>
  )
}
