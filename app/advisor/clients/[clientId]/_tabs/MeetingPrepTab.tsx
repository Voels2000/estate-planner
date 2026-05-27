'use client'

/**
 * Advisor Meeting Prep tab: meeting agenda context plus export/recalculation tools
 * for advisor-client session preparation.
 */

import { useState } from 'react'
import MeetingPrep from '@/components/advisor/MeetingPrep'
import ExportPanel from '@/components/advisor/ExportPanel'
import { meetingPrepBriefFromHorizons } from '@/lib/advisor/meetingPrepHorizons'
import { ClientViewShellProps } from '../_client-view-shell'

function getClientName(household: ClientViewShellProps['household']) {
  if (household?.has_spouse) {
    return `${household.person1_first_name ?? 'Client'} & ${household.person2_first_name ?? 'Spouse'} ${household.person1_last_name ?? ''}`.trim()
  }
  return `${household?.person1_first_name ?? ''} ${household?.person1_last_name ?? ''}`.trim() || 'Client'
}

export default function MeetingPrepTab({
  clientId,
  household,
  exportPanelProps,
  notes,
  scenario,
  estateComposition,
  advisorHorizons,
}: ClientViewShellProps) {
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [recalcSuccess, setRecalcSuccess] = useState<string | null>(null)
  const [recalcError, setRecalcError] = useState<string | null>(null)

  const handleRecalculateBaseCase = async () => {
    setIsRecalculating(true)
    setRecalcSuccess(null)
    setRecalcError(null)

    try {
      const response = await fetch('/api/advisor/generate-base-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: household.id }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setRecalcError(data?.error ?? 'Failed to recalculate base case')
        return
      }

      setRecalcSuccess('Base case updated — reload to see new figures')
    } catch (error) {
      setRecalcError(error instanceof Error ? error.message : 'Failed to recalculate base case')
    } finally {
      setIsRecalculating(false)
    }
  }

  const clientName = getClientName(household)
  const latestOnlyExportPanelProps = exportPanelProps
    ? { ...exportPanelProps, scenarioHistory: exportPanelProps.scenarioHistory.slice(0, 1) }
    : null
  const latestNote = (notes ?? [])[0] as Record<string, unknown> | null
  const latestNoteContent =
    latestNote && typeof latestNote.content === 'string' ? latestNote.content : null
  const latestNoteCreatedAt =
    latestNote && typeof latestNote.created_at === 'string' ? latestNote.created_at : null
  const horizonBrief = meetingPrepBriefFromHorizons(advisorHorizons)
  const initialBriefSeed = {
    health_score_today: exportPanelProps?.healthScore ?? null,
    top_alerts: (exportPanelProps?.actionItems ?? []).slice(0, 3).map((a) => ({
      title: a.message,
      severity: a.severity,
      description: a.message,
    })),
    current_gross_estate:
      horizonBrief?.current_gross_estate ?? estateComposition?.gross_estate ?? null,
    current_taxable_estate: estateComposition?.taxable_estate ?? null,
    current_estimated_tax:
      horizonBrief?.current_estimated_tax ?? estateComposition?.estimated_tax ?? null,
    estimated_tax_state: horizonBrief?.estimated_tax_state ?? null,
    estimated_tax_state_with_cst: horizonBrief?.estimated_tax_state_with_cst ?? null,
    cst_benefit: horizonBrief?.cst_benefit ?? null,
    has_portability_gap: horizonBrief?.has_portability_gap ?? null,
    cst_benefit_at_death: horizonBrief?.cst_benefit_at_death ?? null,
    gross_estate: horizonBrief?.gross_estate ?? null,
    estate_tax: horizonBrief?.estate_tax ?? null,
    net_to_heirs: horizonBrief?.net_to_heirs ?? null,
    cost_of_inaction: horizonBrief?.cost_of_inaction ?? null,
    horizon_columns: horizonBrief?.horizon_columns ?? [],
    at_death_label: horizonBrief?.at_death_label ?? null,
    recommended_strategies: exportPanelProps?.activeStrategies ?? [],
    last_note: latestNoteContent,
    last_note_date: latestNoteCreatedAt,
    has_projection: horizonBrief?.has_projection ?? Boolean(scenario?.id),
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-[color:var(--mwm-navy)] border-l-4 border-[color:var(--mwm-gold)] pl-3 mb-1">Meeting Preparation</h2>
        <p className="text-sm text-gray-500 mb-6">
          Review health score changes, open alerts, and estate snapshot before your client meeting.
        </p>
        <MeetingPrep
          clientId={clientId}
          householdId={household.id}
          clientName={clientName}
          advisorHorizons={advisorHorizons}
          initialHealthScore={exportPanelProps?.healthScore ?? null}
          initialBriefSeed={initialBriefSeed}
        />
      </section>

      {latestOnlyExportPanelProps && (
        <section>
          <h2 className="text-base font-semibold text-[color:var(--mwm-navy)] border-l-4 border-[color:var(--mwm-gold)] pl-3 mb-4">Export & Reports</h2>
          <ExportPanel {...latestOnlyExportPanelProps} />
        </section>
      )}

      <section>
        <div className="mb-4">
          <button
            type="button"
            onClick={handleRecalculateBaseCase}
            disabled={isRecalculating}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isRecalculating
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRecalculating ? 'Recalculating...' : 'Recalculate Base Case'}
          </button>
          {recalcSuccess && <p className="mt-2 text-sm text-green-700">{recalcSuccess}</p>}
          {recalcError && <p className="mt-2 text-sm text-red-700">{recalcError}</p>}
        </div>
      </section>
    </div>
  )
}
