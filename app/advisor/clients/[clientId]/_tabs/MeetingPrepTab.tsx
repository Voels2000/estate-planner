'use client'

import { useState } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import MeetingPrep from '@/components/advisor/MeetingPrep'
import ExportPanel from '@/components/advisor/ExportPanel'
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
  scenarioHistory = [],
  exportPdfData,
  exportExcelData,
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

  return (
    <div className="space-y-8">
      <DisclaimerBanner />

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Meeting Preparation</h2>
        <p className="text-sm text-gray-500 mb-6">
          Review health score changes, open alerts, and estate snapshot before your client meeting.
        </p>
        <MeetingPrep
          clientId={clientId}
          householdId={household.id}
          clientName={clientName}
        />
      </section>

      {exportPdfData && exportExcelData && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Export & Reports</h2>
          <ExportPanel
            clientName={clientName}
            pdfData={exportPdfData}
            excelData={exportExcelData}
            scenarioHistory={scenarioHistory}
          />
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
