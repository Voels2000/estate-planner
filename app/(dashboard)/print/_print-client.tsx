'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExportPDFButton } from '@/components/pdf/ExportPDFButton'

interface Props {
  householdId: string
  isAdvisor: boolean
  tier: number
}

type ExportMode = 'full' | 'attorney'

export function PrintClient({ householdId, isAdvisor, tier }: Props) {
  const [mode, setMode] = useState<ExportMode>('full')

  if (!isAdvisor && tier < 3) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)] mb-2">Export Estate Plan</h1>
        <p className="text-neutral-500">
          Export a full estate plan summary — including conflicts, asset titling, and estate
          tax exposure — for your attorney or advisor review. Available with the Estate plan.
        </p>
      </div>
    )
  }

  const exports: {
    mode: ExportMode
    label: string
    description: string
    sub: string
    badge?: string
    badgeColor?: string
  }[] = [
    {
      mode: 'full',
      label: isAdvisor ? 'Full Advisor Report' : 'Client Summary',
      description: isAdvisor
        ? 'Full estate plan report including tax exposure, recommendations, and incapacity planning.'
        : 'Your complete estate plan — readiness score, document checklist, asset overview, and planning gaps. For your records or to share with your advisor.',
      sub: 'PDF · Complete estate plan data',
    },
    {
      mode: 'attorney',
      label: 'Attorney Summary',
      description:
        'Concise intake summary formatted for an estate attorney — household profile, asset overview, document status, and beneficiary designations. Ready for your first meeting.',
      sub: 'PDF · Attorney intake format',
      badge: 'New',
      badgeColor: 'text-[10px] font-semibold uppercase tracking-wide text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-1.5 py-0.5 rounded',
    },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)] mb-2">
        {isAdvisor ? 'Advisor Estate Plan Report' : 'Export Estate Plan'}
      </h1>
      <p className="text-neutral-500 mb-8">
        {isAdvisor
          ? 'Full estate plan report including tax exposure, recommendations, and incapacity planning.'
          : 'Export your estate plan in different formats for your advisor or attorney.'}
      </p>

      <div className="space-y-4">
        {exports.map(exp => (
          <div
            key={exp.mode}
            onClick={() => setMode(exp.mode)}
            className={`rounded-xl border bg-white p-6 cursor-pointer transition-all ${
              mode === exp.mode
                ? 'border-[color:var(--mwm-navy)] ring-1 ring-[color:var(--mwm-navy)] shadow-sm'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    mode === exp.mode
                      ? 'border-[color:var(--mwm-navy)] bg-[var(--mwm-navy)]'
                      : 'border-neutral-300 bg-white'
                  }`}
                >
                  {mode === exp.mode && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[color:var(--mwm-navy)]">{exp.label}</p>
                    {exp.badge && (
                      <span className={exp.badgeColor}>{exp.badge}</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                    {exp.description}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">{exp.sub}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {mode === 'attorney' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            What&apos;s included in the Attorney Summary
          </p>
          <ul className="space-y-1">
            {[
              'Household profile — names, ages, state of domicile',
              'Asset overview — gross estate, real estate, business interests',
              'Document status — will, POA, healthcare directive, living trust',
              'Beneficiary designations — accounts with missing or outdated designations',
              'Open conflicts — critical issues flagged for attorney review',
            ].map(item => (
              <li key={item} className="text-xs text-amber-700 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-600">
            This format is designed to save attorney intake time. Bring it to your first
            meeting or share it in advance.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-6 py-4">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            {mode === 'attorney'
              ? 'Generate Attorney Summary'
              : isAdvisor
                ? 'Full Advisor Report'
                : 'Client Summary'}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {mode === 'attorney'
              ? 'Concise format for attorney intake'
              : 'Complete estate plan data'}
          </p>
        </div>
        <ExportPDFButton
          householdId={householdId}
          role={isAdvisor ? 'advisor' : 'consumer'}
          variant={mode === 'attorney' ? 'attorney' : undefined}
        />
      </div>

      {mode === 'attorney' && (
        <div className="mt-4 text-center">
          <Link
            href="/find-attorney"
            className="text-xs text-[color:var(--mwm-navy)] hover:underline underline-offset-2"
          >
            Don&apos;t have an attorney yet? Find one in our directory →
          </Link>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6 max-w-lg mx-auto">
        These exports include all data you have entered into My Wealth Maps. Your data belongs to
        you and can be exported at any time.
      </p>
    </div>
  )
}
