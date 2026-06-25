'use client'

import type { InsuranceGapResult } from '@/lib/insurance'
import { formatCurrency } from '@/lib/insurance'

type Props = {
  gaps: InsuranceGapResult[]
}

export function InsuranceGapPanel({ gaps }: Props) {
  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-[color:var(--mwm-navy)]">Coverage gap analysis</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Recommended coverage vs your current policies (computed from household inputs).
      </p>
      <div className="mt-4 space-y-3">
        {gaps.map((g) => (
          <div
            key={g.type}
            className={`rounded-xl border p-4 ${
              g.status === 'adequate'
                ? 'border-green-200 bg-green-50/50'
                : 'border-amber-200 bg-amber-50/40'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-medium text-neutral-900">{g.label}</h3>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  g.status === 'adequate'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {g.status === 'adequate' ? 'Adequate' : 'Gap'}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-600">{g.insight}</p>
            {g.recommended > 0 && (
              <p className="mt-2 text-xs text-neutral-500">
                Current: {g.unit === '$' ? formatCurrency(g.current) : `${g.current} ${g.unit}`}
                {' · '}
                Recommended:{' '}
                {g.unit === '$' ? formatCurrency(g.recommended) : `${g.recommended} ${g.unit}`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
