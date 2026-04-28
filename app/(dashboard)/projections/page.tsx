'use client'

// ─────────────────────────────────────────
// Menu: Financial Planning > Projections
// Route: /projections
// ─────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { loadProjectionPageData } from '@/lib/projections/loaders/loadProjectionPageData'
import type { HouseholdProjectionProfile, ProjectionYear } from '@/lib/projections/types'
import { SummaryCard } from '@/app/(dashboard)/projections/_components/SummaryCard'
import { ProjectionEmptyState } from '@/app/(dashboard)/projections/_components/ProjectionEmptyState'
import { ProjectionTabs } from '@/app/(dashboard)/projections/_components/ProjectionTabs'
import { ProjectionsHeader } from '@/app/(dashboard)/projections/_components/ProjectionsHeader'
import { ProjectionAssumptions } from '@/app/(dashboard)/projections/_components/ProjectionAssumptions'
import { formatDollars } from '@/app/(dashboard)/projections/_utils'
import { getProjectionSummary } from '@/lib/projections/selectors/getProjectionSummary'

export default function ProjectionsPage() {
  const [household, setHousehold] = useState<HouseholdProjectionProfile | null>(null)
  const [projections, setProjections] = useState<ProjectionYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chart' | 'table' | 'income'>('chart')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await loadProjectionPageData()
      setHousehold(data.household)
      setProjections(data.projections)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  if (!household) {
    return (
      <ProjectionEmptyState
        title="Complete your profile first"
        actions={[{ href: '/profile', label: 'Go to Profile →' }]}
      />
    )
  }

  if (projections.length === 0) {
    return (
      <ProjectionEmptyState
        title="No projection data yet"
        description="Complete profile, income, and assets, then run your estate plan to generate projections."
        actions={[
          { href: '/profile', label: 'Complete profile →' },
          { href: '/my-estate-strategy', label: 'Generate estate plan →' },
        ]}
      />
    )
  }

  const { retirementRow, peakNetWorth, fundsOutlast, avgRetirementTax } = getProjectionSummary(projections)
  const p1 = displayPersonFirstName(household.person1_name, 'Person 1')
  const p2 = household.has_spouse ? displayPersonFirstName(household.person2_name, 'Person 2') : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <ProjectionsHeader />

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {/* Growth assumptions (read-only from profile) */}
      <ProjectionAssumptions household={household} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Net Worth at Retirement"
          value={formatDollars(retirementRow?.net_worth ?? 0)}
          sub={`Age ${household.person1_retirement_age} · includes RE & business`}
        />
        <SummaryCard
          label="Financial Portfolio at Retirement"
          value={formatDollars(retirementRow?.portfolio ?? 0)}
          sub={`Age ${household.person1_retirement_age} · investable assets only`}
        />
        <SummaryCard label="Avg Tax in Retirement" value={formatDollars(avgRetirementTax)} sub="Federal + state/yr" highlight="amber" />
        <SummaryCard label="Funds Outlast" value={fundsOutlast ? 'Yes ✓' : 'No ✗'} sub={fundsOutlast ? 'On track' : 'Review plan'} highlight={fundsOutlast ? 'green' : 'red'} />
      </div>

      {/* Chart / Table / Income tabs */}
      <ProjectionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        projections={projections}
        peakNetWorth={peakNetWorth}
        p1={p1}
        p2={p2}
      />

      <p className="mt-4 text-xs text-neutral-400">
        * Projection tax estimates include federal income tax, state income tax, capital gains tax,
        NIIT, payroll tax, and IRMAA surcharges. Federal tax uses filing status and your selected
        deduction mode; state income tax uses progressive state bracket tables by filing status and year.
      </p>
    </div>
  )
}
