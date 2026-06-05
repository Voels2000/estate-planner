'use client'

import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { scoreCategoryExplainer } from '@/lib/estate-health-score'
import { getBand, getPctile } from '@/lib/dashboard/scoreDisplayHelpers'
import { NAT_AVG_PCT, MWM_AVG_PCT } from '@/lib/dashboard/readinessBenchmarks'

type ComponentRow = {
  key: string
  label: string
  score: number
  maxScore: number
  status: string
}

type EstateReadinessCardProps = {
  score: number
  priorScore: number | null
  components: ComponentRow[]
}

export function EstateReadinessCard({ score, priorScore, components }: EstateReadinessCardProps) {
  const band = getBand(score)
  const delta = priorScore !== null ? score - priorScore : null
  const pctile = getPctile(score)

  return (
    <div className="space-y-4 rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-medium text-[color:var(--mwm-navy)]">{score}</span>
            <span className="text-lg text-[color:var(--mwm-text-secondary)]">/100</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-[color:var(--mwm-text-secondary)]">Estate readiness</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: band.pillBg, color: band.pillText }}
            >
              {band.label}
            </span>
          </div>
        </div>
        {delta !== null && (
          <div className="text-right">
            <div
              className="text-sm font-medium"
              style={{ color: delta >= 0 ? '#3B6D11' : '#A32D2D' }}
            >
              {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}
              {delta} pts
            </div>
            <div className="text-[10px] text-[color:var(--mwm-text-secondary)]">since last session</div>
          </div>
        )}
      </div>

      <div>
        <div className="relative mb-1 h-2 rounded-full bg-[color:var(--mwm-surface)]">
          <div
            className="absolute h-2 rounded-full transition-all"
            style={{ width: `${score}%`, background: band.fillColor }}
          />
          <div
            className="absolute top-[-3px] h-[14px] w-[2px] rounded-full bg-[#B4B2A9]"
            style={{ left: `${NAT_AVG_PCT}%` }}
          />
          <div
            className="absolute top-[-3px] h-[14px] w-[2px] rounded-full bg-[#1D9E75]"
            style={{ left: `${MWM_AVG_PCT}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[color:var(--mwm-text-secondary)]">
          <span>0</span>
          <span className="text-center">{pctile}</span>
          <span>100</span>
        </div>
        <div className="mt-1 flex gap-4 text-[10px] text-[color:var(--mwm-text-secondary)]">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#B4B2A9] align-middle" />
            Avg. American
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#1D9E75] align-middle" />
            Avg. MWM user
          </span>
        </div>
      </div>

      {components.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[color:var(--mwm-text-secondary)]">
            What makes up your score
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {components.map((c) => {
              const pct = c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0
              const pillColor =
                c.status === 'good' ? '#3B6D11' : c.status === 'warning' ? '#854F0B' : '#A32D2D'
              const barFill =
                c.status === 'good' ? '#639922' : c.status === 'warning' ? '#EF9F27' : '#E24B4A'
              const explainer = scoreCategoryExplainer(c.key)
              return (
                <div key={c.key} className="rounded bg-[color:var(--mwm-surface)] p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] text-[color:var(--mwm-text-secondary)]">
                      {c.label}
                      {explainer && <InfoTooltip content={explainer} size="sm" />}
                    </span>
                    <span className="text-xs font-medium" style={{ color: pillColor }}>
                      {c.score}/{c.maxScore}
                    </span>
                  </div>
                  <div className="h-[3px] rounded-full bg-[color:var(--mwm-border)]">
                    <div
                      className="h-[3px] rounded-full"
                      style={{ width: `${pct}%`, background: barFill }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="border-t border-[color:var(--mwm-border)] pt-3 text-[11px] leading-relaxed text-[color:var(--mwm-text-secondary)]">
        This reflects information you&apos;ve entered and is for planning preparation only — not
        financial, tax, or legal advice. Consult qualified professionals before making decisions.
      </p>
    </div>
  )
}
