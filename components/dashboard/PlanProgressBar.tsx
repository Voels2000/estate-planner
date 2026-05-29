'use client'

import Link from 'next/link'
import type { PlanStageResult } from '@/lib/dashboard/determinePlanStage'

interface PlanProgressBarProps {
  planStage: PlanStageResult
  showAllTools: boolean
  onShowAllTools: () => void
  onQuickAddAsset?: () => void
  useQuickAddForNextAction?: boolean
}

export function PlanProgressBar({
  planStage,
  showAllTools,
  onShowAllTools,
  onQuickAddAsset,
  useQuickAddForNextAction = false,
}: PlanProgressBarProps) {
  const { stage, stageLabel, nextActionLabel, nextActionHref, progressPct, detailLabel } =
    planStage
  const isComplete = stage === 4 && progressPct >= 95

  return (
    <div className="rounded-xl border border-[color:var(--mwm-border)] bg-[color:var(--mwm-off-white)]/50 px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-[color:var(--mwm-text-muted)]">
            {stageLabel}
          </span>
          {isComplete && (
            <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
              Complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-lg font-bold ${
              isComplete
                ? 'text-[color:var(--mwm-sage)]'
                : progressPct >= 50
                  ? 'text-[color:var(--mwm-navy)]'
                  : 'text-amber-600'
            }`}
          >
            {progressPct}%
          </span>
          <button
            type="button"
            onClick={onShowAllTools}
            className="text-[11px] text-[color:var(--mwm-text-muted)] transition-colors hover:text-[color:var(--mwm-navy)]"
          >
            {showAllTools ? 'Guided view' : 'Show all tools'}
          </button>
        </div>
      </div>

      <div className="mb-3 h-2 rounded-full bg-neutral-100">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            isComplete
              ? 'bg-[color:var(--mwm-sage)]'
              : progressPct >= 50
                ? 'bg-[color:var(--mwm-navy)]'
                : 'bg-amber-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-[color:var(--mwm-text-muted)]">{detailLabel}</p>
        {!isComplete && (
          useQuickAddForNextAction && onQuickAddAsset ? (
            <button
              type="button"
              onClick={onQuickAddAsset}
              className="shrink-0 text-xs font-semibold text-[color:var(--mwm-navy)] transition-colors hover:text-[color:var(--mwm-gold)]"
            >
              {nextActionLabel} →
            </button>
          ) : (
            <Link
              href={nextActionHref}
              className="shrink-0 text-xs font-semibold text-[color:var(--mwm-navy)] transition-colors hover:text-[color:var(--mwm-gold)]"
            >
              {nextActionLabel} →
            </Link>
          )
        )}
      </div>
    </div>
  )
}
