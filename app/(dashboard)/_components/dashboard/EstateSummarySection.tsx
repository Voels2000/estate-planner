import Link from 'next/link'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import EstateCompositionCard from '@/components/estate/EstateCompositionCard'
import type { EstateComposition } from '@/lib/estate/types'
import { fmtExact } from '@/app/(dashboard)/_components/dashboard/formatters'
import { hasEstateData } from '@/app/(dashboard)/_components/dashboard/state-helpers'

type ConflictReport = {
  conflicts: Array<{
    conflict_type: string
    severity: string
    description: string
    recommended_action: string
  }>
  critical: number
  warnings: number
} | null

type EstateSummarySectionProps = {
  storageKey: string
  totalAssets: number
  netWorth: number
  conflictReport?: ConflictReport
  composition?: EstateComposition | null
}

export function EstateSummarySection(props: EstateSummarySectionProps) {
  const criticalCount = props.conflictReport?.critical ?? 0
  const warningCount = props.conflictReport?.warnings ?? 0

  return (
    <CollapsibleSection
      title="Estate Summary"
      subtitle={
        hasEstateData({ totalAssets: props.totalAssets })
          ? `${fmtExact(props.netWorth)} net worth · composition and titling`
          : 'Add assets to see your estate summary'
      }
      defaultOpen={false}
      storageKey={props.storageKey}
      locked={!hasEstateData({ totalAssets: props.totalAssets })}
      lockedMessage="Add your assets to see your estate composition and titling conflicts."
      lockedHref="/assets"
      lockedHrefLabel="Add assets"
    >
      <div className="space-y-6">
        {props.composition && (
          <div className="mb-6">
            <EstateCompositionCard composition={props.composition} label="Your Estate" snapshotLabel="Current snapshot" />
          </div>
        )}

        {props.conflictReport && (criticalCount > 0 || warningCount > 0) && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Titling & Beneficiary Conflicts
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {criticalCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                  <i className="ti ti-alert-circle" aria-hidden="true" style={{ fontSize: 11 }} />
                  {criticalCount} critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                  <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 11 }} />
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
              <Link
                href="/titling"
                className="text-xs text-emerald-700 underline underline-offset-2"
              >
                Review in Titling & Beneficiaries →
              </Link>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
