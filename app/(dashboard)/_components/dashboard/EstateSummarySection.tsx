import type { ReactNode } from 'react'
import Link from 'next/link'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import EstateCompositionCard from '@/components/estate/EstateCompositionCard'
import type { EstateComposition } from '@/lib/estate/types'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import {
  EstateHealthScoreBlock,
  EstateHealthScoreHeaderBadge,
} from '@/components/shared/EstateHealthScoreBlock'
import { fmtExact } from '@/app/(dashboard)/_components/dashboard/formatters'
import { hasEstateData } from '@/app/(dashboard)/_components/dashboard/state-helpers'
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'
import { resolveEstateActionHref } from '@/lib/dashboard/estateUpgradeHref'

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
  estateHealthScore?: EstateHealthScore | null
  conflictReport?: ConflictReport
  composition?: EstateComposition | null
  consumerTier?: number
}

function TierAwareEstateLink({
  href,
  consumerTier,
  className,
  children,
}: {
  href: string
  consumerTier?: number
  className?: string
  children: ReactNode
}) {
  const resolved = resolveEstateActionHref(href, consumerTier)
  return (
    <Link href={resolved} className={className}>
      {children}
    </Link>
  )
}

export function EstateSummarySection(props: EstateSummarySectionProps) {
  const { consumerTier } = props

  return (
    <CollapsibleSection
      title="Estate Summary"
      subtitle={
        hasEstateData({ totalAssets: props.totalAssets }) && props.estateHealthScore
          ? `Readiness score ${props.estateHealthScore.score}/100 · ${fmtExact(props.netWorth)} estate`
          : hasEstateData({ totalAssets: props.totalAssets })
            ? `${fmtExact(props.netWorth)} estate · complete health check for score`
            : 'Add assets to see your estate summary'
      }
      badge={
        props.estateHealthScore ? (
          <EstateHealthScoreHeaderBadge score={props.estateHealthScore.score} />
        ) : undefined
      }
      defaultOpen={false}
      storageKey={props.storageKey}
      locked={!hasEstateData({ totalAssets: props.totalAssets })}
      lockedMessage="Add your assets to see your estate readiness score and tax exposure."
      lockedHref="/assets"
      lockedHrefLabel="Add assets"
    >
      <div className="space-y-6">
        {props.estateHealthScore && (
          <div className={`rounded-xl border p-5 ${props.estateHealthScore.score >= 75 ? 'bg-[var(--mwm-sage-pale)] border-[color:var(--mwm-sage-pale)]' : props.estateHealthScore.score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
            <EstateHealthScoreBlock
              estateHealthScore={props.estateHealthScore}
              componentsGrid={
                <>
                  {props.estateHealthScore.components.map((component) => (
                    <TierAwareEstateLink
                      key={component.key}
                      href={component.actionHref}
                      consumerTier={consumerTier}
                      className="bg-white rounded-xl border border-neutral-200 px-3 py-3 hover:shadow-sm transition block"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-neutral-600 truncate">{component.label}</span>
                        <span className={`text-xs font-bold ml-2 shrink-0 ${component.status === 'good' ? 'text-[color:var(--mwm-sage)]' : component.status === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>
                          {component.score}/{component.maxScore}
                        </span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${component.status === 'good' ? 'bg-[var(--mwm-sage)]' : component.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.round((component.score / component.maxScore) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1.5 truncate">{component.actionLabel}</p>
                    </TierAwareEstateLink>
                  ))}
                </>
              }
            />
            <p className="text-xs text-neutral-400 mt-4 max-w-xl">{DISCLAIMER_STRINGS.dashboard}</p>
          </div>
        )}

        {!props.estateHealthScore && hasEstateData({ totalAssets: props.totalAssets }) && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-900">Generate your estate plan to see your health score.</p>
            <p className="mt-1 text-xs text-blue-700">
              We&apos;ll show your readiness score here after your first successful recompute.
            </p>
          </div>
        )}

        {props.composition && (
          <div className="mb-6">
            <EstateCompositionCard composition={props.composition} label="Your Estate" snapshotLabel="Current snapshot" />
          </div>
        )}

        {props.conflictReport &&
          (props.conflictReport.critical > 0 || props.conflictReport.warnings > 0) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
              Titling & Beneficiary Conflicts
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {props.conflictReport.critical > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-800">
                  <i className="ti ti-alert-circle" aria-hidden="true" style={{ fontSize: 11 }} />
                  {props.conflictReport.critical} critical
                </span>
              )}
              {props.conflictReport.warnings > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800">
                  <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 11 }} />
                  {props.conflictReport.warnings} warning{props.conflictReport.warnings !== 1 ? 's' : ''}
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
