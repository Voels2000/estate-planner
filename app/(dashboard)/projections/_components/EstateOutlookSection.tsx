import { EstateOutlookChart } from '@/app/(dashboard)/projections/_components/EstateOutlookChart'
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'
import type { PercentileByYear } from '@/lib/calculations/estate-monte-carlo'

type Props = {
  bands: PercentileByYear[]
  growthReturnMeanPct?: number
  mcUpdating?: boolean
  /** Tier 3 estate overlay — omit on Tier 2 surfaces (monte-carlo). */
  stateExemption?: number | null
}

/**
 * Precomputed estate MC fan (P10–P90 gross). Tier 2+ surface; not on /projections (PR 4).
 */
export function EstateOutlookSection({
  bands,
  growthReturnMeanPct = 7,
  mcUpdating = false,
  stateExemption = null,
}: Props) {
  if (!bands.length) return null

  return (
    <section className="mt-8" data-testid="computed-estate-outlook-section">
      {mcUpdating ? (
        <p className="mb-2 text-xs font-medium text-amber-700">
          Updating Monte Carlo analysis — showing last saved results.
        </p>
      ) : null}
      <h2 className="mb-1 text-sm font-semibold text-[--mwm-text-primary]">
        Estate Outlook — Range of Outcomes
      </h2>
      <p className="mb-3 text-xs text-[--mwm-text-muted]">
        Gross estate range across 500 simulated market scenarios. Base case assumes{' '}
        {growthReturnMeanPct}% annual growth.
      </p>
      <EstateOutlookChart bands={bands} stateExemption={stateExemption} />
      <p className="mt-2 text-xs text-[--mwm-text-muted]">{DISCLAIMER_STRINGS.projectionsChart}</p>
    </section>
  )
}
