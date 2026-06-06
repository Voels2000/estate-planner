'use client'

/**
 * Consumer projections page: server-prefetched via `loadProjectionData` in `page.tsx`;
 * summary cards, chart/table/income tabs, and assumptions footer.
 *
 * Route: `/projections`
 */

import { useEffect, useState } from 'react'
import { displayPersonFirstName } from '@/lib/display-person-name'
import type { HouseholdProjectionProfile, ProjectionYear } from '@/lib/projections/types'
import type { ProjectionReadinessResult } from '@/lib/planning/projectionReadiness'
import type { ProfileFieldDef } from '@/lib/profile/profileFieldPromptDefs'
import { ProfileFieldPrompt } from '@/components/profile/ProfileFieldPrompt'
import { SummaryCard } from '@/app/(dashboard)/projections/_components/SummaryCard'
import { ProjectionEmptyState } from '@/app/(dashboard)/projections/_components/ProjectionEmptyState'
import { ProjectionTabs } from '@/app/(dashboard)/projections/_components/ProjectionTabs'
import { ProjectionsHeader } from '@/app/(dashboard)/projections/_components/ProjectionsHeader'
import { ProjectionAssumptions } from '@/app/(dashboard)/projections/_components/ProjectionAssumptions'
import { formatDollars } from '@/app/(dashboard)/projections/_utils'
import { buildProjectionSummaryCards } from '@/lib/view-models/projectionSummaryCards'
import { ScenariosExploreCard } from '@/app/(dashboard)/projections/_components/ScenariosExploreCard'
import { EstateOutlookChart } from '@/app/(dashboard)/projections/_components/EstateOutlookChart'
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'
import type { PercentileByYear } from '@/lib/calculations/estate-monte-carlo'
import {
  PLANNING_MISSING_PROJECTION_ACTIONS_TIER2,
  PLANNING_MISSING_PROJECTION_DESCRIPTION_PROJECTIONS,
  PLANNING_NO_HOUSEHOLD_ACTIONS,
} from '@/lib/planning/planningEmptyState'

type ProjectionsClientProps = {
  initialHousehold: (HouseholdProjectionProfile & { growth_assumptions?: unknown }) | null
  initialProjections: ProjectionYear[]
  readiness: ProjectionReadinessResult
  projectionPlanningFields: ProfileFieldDef[]
  householdId: string | null
  hasRealEstate?: boolean
  hasBusiness?: boolean
  mcBands?: PercentileByYear[] | null
  stateExemption?: number | null
}

export function ProjectionsClient({
  initialHousehold,
  initialProjections,
  readiness,
  projectionPlanningFields,
  householdId,
  hasRealEstate = true,
  hasBusiness = true,
  mcBands = null,
  stateExemption = null,
}: ProjectionsClientProps) {
  const [household, setHousehold] = useState<HouseholdProjectionProfile | null>(initialHousehold)
  const [projections, setProjections] = useState<ProjectionYear[]>(initialProjections)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chart' | 'table' | 'income'>('chart')

  useEffect(() => {
    setHousehold(initialHousehold)
    setProjections(initialProjections)
  }, [initialHousehold, initialProjections])

  if (!household) {
    return (
      <ProjectionEmptyState
        title="Complete your profile first"
        actions={[...PLANNING_NO_HOUSEHOLD_ACTIONS]}
      />
    )
  }

  if (!readiness.ready && !readiness.canShowPartial) {
    return <ProjectionEmptyState missingFields={readiness.missingFields} />
  }

  if (projections.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <ProjectionsHeader />
        {householdId && projectionPlanningFields.length > 0 ? (
          <ProfileFieldPrompt
            promptKey="projections_planning"
            title="Complete your projection setup"
            description="Add the details below to generate your retirement timeline."
            fields={projectionPlanningFields}
            householdId={householdId}
          />
        ) : null}
        <ProjectionEmptyState
          title="No projection data yet"
          description={PLANNING_MISSING_PROJECTION_DESCRIPTION_PROJECTIONS}
          actions={[...PLANNING_MISSING_PROJECTION_ACTIONS_TIER2]}
        />
      </div>
    )
  }

  const { peakNetWorth, cards } = buildProjectionSummaryCards({
    projections,
    person1RetirementAge: household.person1_retirement_age ?? null,
    formatDollars,
  })
  const p1 = displayPersonFirstName(household.person1_name, 'Person 1')
  const p2 = household.has_spouse ? displayPersonFirstName(household.person2_name, 'Person 2') : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <ProjectionsHeader />

      {!readiness.ready && readiness.canShowPartial && householdId && projectionPlanningFields.length > 0 ? (
        <ProfileFieldPrompt
          promptKey="projections_planning"
          title="Complete your projection setup"
          description="Add the details below to improve your retirement timeline."
          fields={projectionPlanningFields}
          householdId={householdId}
        />
      ) : null}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <ProjectionAssumptions
        household={household}
        hasRealEstate={hasRealEstate}
        hasBusiness={hasBusiness}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            sub={card.sub}
            highlight={card.highlight}
          />
        ))}
      </div>

      <p className="mb-6 text-xs text-neutral-400">{DISCLAIMER_STRINGS.projections}</p>

      <ScenariosExploreCard />

      <ProjectionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        projections={projections}
        peakNetWorth={peakNetWorth}
        p1={p1}
        p2={p2}
        chartDisclaimer={DISCLAIMER_STRINGS.projectionsChart}
      />

      {mcBands && mcBands.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-1 text-sm font-semibold text-[--mwm-text-primary]">
            Estate Outlook — Range of Outcomes
          </h2>
          <p className="mb-3 text-xs text-[--mwm-text-muted]">
            Gross estate range across 500 simulated market scenarios. Base case assumes{' '}
            {initialHousehold?.growth_assumptions
              ? `${(initialHousehold.growth_assumptions as { returnMeanPct?: number }).returnMeanPct ?? 7}%`
              : '7%'}{' '}
            annual growth.
          </p>
          <EstateOutlookChart bands={mcBands} stateExemption={stateExemption ?? null} />
          <p className="mt-2 text-xs text-[--mwm-text-muted]">
            {DISCLAIMER_STRINGS.projectionsChart}
          </p>
        </section>
      ) : null}

      <p className="mt-4 text-xs text-neutral-400">
        * Projection tax estimates include federal income tax, state income tax, capital gains tax,
        NIIT, payroll tax, and IRMAA surcharges. Federal tax uses filing status and your selected
        deduction mode; state income tax uses progressive state bracket tables by filing status and year.
      </p>
    </div>
  )
}
