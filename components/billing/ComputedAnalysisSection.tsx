'use client'

import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { featureUpgradeTier } from '@/lib/tiers'
import type { ComputedAnalysisFeature } from '@/lib/access/inputComputedBoundary'
import { minTierForComputedAnalysis } from '@/lib/access/inputComputedBoundary'

type Props = {
  canAccess: boolean
  feature: ComputedAnalysisFeature
  moduleName: string
  valueProposition: string
  children: React.ReactNode
}

/** Inline gate for computed readouts on otherwise-free data-entry pages. */
export function ComputedAnalysisSection({
  canAccess,
  feature,
  moduleName,
  valueProposition,
  children,
}: Props) {
  if (canAccess) return <>{children}</>

  const requiredTier = minTierForComputedAnalysis(feature)

  return (
    <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <h2 className="text-sm font-semibold text-[color:var(--mwm-navy)]">{moduleName}</h2>
      <p className="mt-1 text-xs text-[color:var(--mwm-text-secondary)]">
        Your entries are saved. Upgrade to see computed analysis.
      </p>
      <div className="mt-4">
        <UpgradeBanner
          requiredTier={featureUpgradeTier(feature)}
          moduleName={moduleName}
          valueProposition={valueProposition}
        />
      </div>
      <p className="mt-2 text-[10px] text-[color:var(--mwm-text-muted)]">
        Requires {requiredTier === 2 ? 'Retirement' : 'Estate'} plan or app trial.
      </p>
    </div>
  )
}
