'use client'

import { ExportPDFButton } from '@/components/pdf/ExportPDFButton'

interface Props {
  householdId: string
  isAdvisor: boolean
  tier: number
}

export function PrintClient({ householdId, isAdvisor, tier }: Props) {
  if (!isAdvisor && tier < 3) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Export Estate Plan</h1>
        <p className="text-neutral-500">Upgrade to Estate Planning (Tier 3) to export your estate plan summary.</p>
      </div>
    )
  }

  const title = isAdvisor ? 'Advisor Estate Plan Report' : 'Estate Plan Summary'
  const description = isAdvisor
    ? 'Full estate plan report including tax exposure, recommendations, and incapacity planning.'
    : 'Your estate plan summary including checklist and incapacity planning documents.'

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">{title}</h1>
      <p className="text-neutral-500 mb-8">{description}</p>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            {isAdvisor ? 'Full Advisor Report' : 'Client Summary'}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">PDF — includes all estate plan data</p>
        </div>
        <ExportPDFButton
          householdId={householdId}
          role={isAdvisor ? 'advisor' : 'consumer'}
        />
      </div>
    </div>
  )
}
