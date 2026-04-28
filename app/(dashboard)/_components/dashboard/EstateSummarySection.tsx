import Link from 'next/link'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import EstateCompositionCard from '@/components/estate/EstateCompositionCard'
import type { EstateComposition } from '@/lib/estate/types'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import { scoreBg, scoreColor, scoreLabel } from '@/lib/estate-health-score'
import { fmtExact } from '@/app/(dashboard)/_components/dashboard/formatters'
import { PlanningGapsSection } from '@/app/(dashboard)/_components/dashboard/PlanningGapsSection'
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
  estateHealthScore?: EstateHealthScore | null
  conflictReport?: ConflictReport
  composition?: EstateComposition | null
  householdId?: string | null
  initialRecommendations?: Array<{
    branch: string
    priority: 'high' | 'moderate' | 'low'
    reason: string
  }> | null
}

export function EstateSummarySection(props: EstateSummarySectionProps) {
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
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(props.estateHealthScore.score)} bg-neutral-100`}>
            {props.estateHealthScore.score}/100
          </span>
        ) : undefined
      }
      defaultOpen={false}
      storageKey={props.storageKey}
      locked={!hasEstateData({ totalAssets: props.totalAssets })}
      lockedMessage="Add your assets to see your estate readiness score, planning gaps, and tax exposure."
      lockedHref="/assets"
      lockedHrefLabel="Add assets"
    >
      <div className="space-y-6">
        {props.estateHealthScore && (
          <div className={`rounded-xl border p-5 ${scoreBg(props.estateHealthScore.score)}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Estate Readiness Score</p>
                <div className="flex items-end gap-3">
                  <span className={`text-5xl font-bold ${scoreColor(props.estateHealthScore.score)}`}>{props.estateHealthScore.score}</span>
                  <span className="text-neutral-400 text-base mb-1">/ 100</span>
                  <span className={`mb-1 text-sm font-semibold ${scoreColor(props.estateHealthScore.score)}`}>{scoreLabel(props.estateHealthScore.score)}</span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">Based on documents, beneficiaries, titling, domicile, and estate tax awareness</p>
              </div>
              <Link href="/health-check" className="shrink-0 rounded-lg bg-white border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-sm">
                Update health check →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {props.estateHealthScore.components.map((component) => (
                <Link key={component.key} href={component.actionHref} className="bg-white rounded-xl border border-neutral-200 px-3 py-3 hover:shadow-sm transition">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-neutral-600 truncate">{component.label}</span>
                    <span className={`text-xs font-bold ml-2 shrink-0 ${component.status === 'good' ? 'text-emerald-600' : component.status === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>
                      {component.score}/{component.maxScore}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${component.status === 'good' ? 'bg-emerald-500' : component.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.round((component.score / component.maxScore) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1.5 truncate">{component.actionLabel}</p>
                </Link>
              ))}
            </div>
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

        {props.householdId && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Planning Gaps</p>
            <PlanningGapsSection householdId={props.householdId} initialRecommendations={props.initialRecommendations} />
          </div>
        )}

        {props.conflictReport && props.conflictReport.conflicts.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Titling & Beneficiary Conflicts</p>
              {props.conflictReport.critical > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {props.conflictReport.critical} critical
                </span>
              )}
              {props.conflictReport.warnings > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {props.conflictReport.warnings} warning{props.conflictReport.warnings !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
              <div className="divide-y divide-neutral-50">
                {props.conflictReport.conflicts.slice(0, 4).map((conflict, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <span
                      className={`mt-0.5 shrink-0 ${
                        conflict.severity === 'critical'
                          ? 'text-red-500'
                          : conflict.severity === 'warning'
                            ? 'text-amber-500'
                            : 'text-blue-400'
                      }`}
                    >
                      {conflict.severity === 'critical' ? '⚠' : conflict.severity === 'warning' ? '○' : 'ℹ'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-800">{conflict.description}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{conflict.recommended_action}</p>
                    </div>
                  </div>
                ))}
              </div>
              {props.conflictReport.conflicts.length > 4 && (
                <div className="px-4 py-3 border-t border-neutral-100 text-center">
                  <Link href="/titling" className="text-xs text-indigo-600 hover:underline">
                    View all {props.conflictReport.conflicts.length} items →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
