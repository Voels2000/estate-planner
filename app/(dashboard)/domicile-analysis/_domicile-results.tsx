'use client'

import Link from 'next/link'

import type { DomicileAnalysisRow, StateWithDays } from './types'

// State tax data — estate tax threshold updated for 2026 (OBBB Act)
const STATE_TAX_DATA: Record<
  string,
  {
    income_tax: string
    estate_tax: boolean
    estate_threshold: string | null
    inheritance_tax: boolean
    notes: string | null
  }
> = {
  AL: { income_tax: '5.0%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  AK: { income_tax: 'None', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'No income or estate tax' },
  AZ: { income_tax: '2.5%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  AR: { income_tax: '4.4%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  CA: { income_tax: 'Up to 13.3%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'Highest income tax in US' },
  CO: { income_tax: '4.4%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  CT: { income_tax: 'Up to 6.99%', estate_tax: true, estate_threshold: '$13.61M', inheritance_tax: false, notes: null },
  DE: { income_tax: 'Up to 6.6%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  FL: { income_tax: 'None', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'Popular domicile — no income or estate tax' },
  GA: { income_tax: '5.49%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  HI: { income_tax: 'Up to 11%', estate_tax: true, estate_threshold: '$5.49M', inheritance_tax: false, notes: 'Low estate threshold' },
  ID: { income_tax: '5.8%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  IL: { income_tax: '4.95%', estate_tax: true, estate_threshold: '$4M', inheritance_tax: false, notes: 'Low estate threshold' },
  IN: { income_tax: '3.15%', estate_tax: false, estate_threshold: null, inheritance_tax: true, notes: 'Inheritance tax applies' },
  IA: { income_tax: '4.82%', estate_tax: false, estate_threshold: null, inheritance_tax: true, notes: 'Phasing out inheritance tax' },
  KS: { income_tax: 'Up to 5.7%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  KY: { income_tax: '4.5%', estate_tax: false, estate_threshold: null, inheritance_tax: true, notes: 'Inheritance tax applies' },
  LA: { income_tax: 'Up to 4.25%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  ME: { income_tax: 'Up to 7.15%', estate_tax: true, estate_threshold: '$6.41M', inheritance_tax: false, notes: null },
  MD: { income_tax: 'Up to 5.75%', estate_tax: true, estate_threshold: '$5M', inheritance_tax: true, notes: 'Both estate and inheritance tax' },
  MA: { income_tax: 'Up to 9%', estate_tax: true, estate_threshold: '$2M', inheritance_tax: false, notes: 'Very low estate threshold' },
  MI: { income_tax: '4.25%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  MN: { income_tax: 'Up to 9.85%', estate_tax: true, estate_threshold: '$3M', inheritance_tax: false, notes: null },
  MS: { income_tax: '4.7%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  MO: { income_tax: 'Up to 4.95%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  MT: { income_tax: 'Up to 6.75%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  NE: { income_tax: 'Up to 5.84%', estate_tax: false, estate_threshold: null, inheritance_tax: true, notes: 'Inheritance tax applies' },
  NV: { income_tax: 'None', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'No income or estate tax' },
  NH: { income_tax: 'None', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'No income tax on wages' },
  NJ: { income_tax: 'Up to 10.75%', estate_tax: false, estate_threshold: null, inheritance_tax: true, notes: 'Inheritance tax applies' },
  NM: { income_tax: 'Up to 5.9%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  NY: { income_tax: 'Up to 10.9%', estate_tax: true, estate_threshold: '$6.94M', inheritance_tax: false, notes: '"Cliff tax" — estate over threshold taxed from $1' },
  NC: { income_tax: '4.5%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  ND: { income_tax: 'Up to 2.5%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  OH: { income_tax: 'Up to 3.99%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  OK: { income_tax: 'Up to 4.75%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  OR: { income_tax: 'Up to 9.9%', estate_tax: true, estate_threshold: '$1M', inheritance_tax: false, notes: 'Lowest estate threshold in US' },
  PA: { income_tax: '3.07%', estate_tax: false, estate_threshold: null, inheritance_tax: true, notes: 'Inheritance tax applies' },
  RI: { income_tax: 'Up to 5.99%', estate_tax: true, estate_threshold: '$1.77M', inheritance_tax: false, notes: null },
  SC: { income_tax: 'Up to 6.4%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  SD: { income_tax: 'None', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'No income or estate tax' },
  TN: { income_tax: 'None', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'No income tax' },
  TX: { income_tax: 'None', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'No income or estate tax' },
  UT: { income_tax: '4.55%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  VT: { income_tax: 'Up to 8.75%', estate_tax: true, estate_threshold: '$5M', inheritance_tax: false, notes: null },
  VA: { income_tax: 'Up to 5.75%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  WA: { income_tax: 'None', estate_tax: true, estate_threshold: '$2.193M', inheritance_tax: false, notes: 'No income tax but has estate tax' },
  WV: { income_tax: 'Up to 6.5%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  WI: { income_tax: 'Up to 7.65%', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: null },
  WY: { income_tax: 'None', estate_tax: false, estate_threshold: null, inheritance_tax: false, notes: 'No income or estate tax' },
  DC: { income_tax: 'Up to 10.75%', estate_tax: true, estate_threshold: '$4.528M', inheritance_tax: false, notes: null },
}

const RISK_CONFIG = {
  low: { label: 'Low risk', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', bar: 'bg-green-500' },
  moderate: { label: 'Moderate risk', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500' },
  high: { label: 'High risk', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', bar: 'bg-orange-500' },
  critical: { label: 'Critical risk', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', bar: 'bg-red-500' },
}

function stateCodesFromAnalysis(analysis: DomicileAnalysisRow): string[] {
  const raw = analysis.states
  if (!Array.isArray(raw)) return []
  return raw.map((s) => (typeof s === 'string' ? s : (s as StateWithDays).state)).filter(Boolean) as string[]
}

export type DomicileResultsProps = {
  analysis: DomicileAnalysisRow & {
    risk_level?: string | null
    risk_score?: number | null
    conflict_states?: string[] | null
    recommendations?: string[] | null
  }
  onRerun: () => void
  onViewChecklist: () => void
}

export default function DomicileResults({
  analysis,
  onRerun,
  onViewChecklist,
}: DomicileResultsProps) {
  const riskLevel = (analysis.risk_level ?? 'low') as keyof typeof RISK_CONFIG
  const config = RISK_CONFIG[riskLevel] ?? RISK_CONFIG.low
  const score = analysis.risk_score ?? 0

  const conflictStates = Array.isArray(analysis.conflict_states)
    ? analysis.conflict_states
    : []

  const involvedStates: string[] = Array.from(
    new Set([
      analysis.claimed_domicile_state,
      ...conflictStates,
      ...stateCodesFromAnalysis(analysis),
    ])
  ).filter(Boolean) as string[]

  const hasDualEstateTax =
    involvedStates.filter((s) => STATE_TAX_DATA[s]?.estate_tax).length >= 2

  const recommendations: string[] = Array.isArray(analysis.recommendations)
    ? analysis.recommendations
    : []

  return (
    <div className="space-y-8">
      <div className={`rounded-lg border p-6 ${config.bg} ${config.border}`}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Domicile risk score</p>
            <p className={`mt-1 text-5xl font-semibold ${config.color}`}>{score}</p>
            <p className={`mt-1 text-sm font-medium ${config.color}`}>{config.label}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Claimed domicile</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {analysis.claimed_domicile_state}
            </p>
          </div>
        </div>

        <div className="h-2 w-full rounded-full border border-gray-200 bg-white">
          <div
            className={`h-2 rounded-full transition-all ${config.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>0 — low</span>
          <span>100 — critical</span>
        </div>
      </div>

      {conflictStates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 text-sm font-medium text-amber-800">Conflicting states detected</p>
          <p className="text-sm text-amber-700">
            Based on your inputs, the following states could claim you as a domiciliary:{' '}
            <span className="font-medium">{conflictStates.join(', ')}</span>. Double domicile can
            result in estate taxes being levied by multiple states simultaneously.
          </p>
        </div>
      )}

      {hasDualEstateTax && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-1 text-sm font-medium text-red-800">Dual estate tax exposure</p>
          <p className="text-sm text-red-700">
            Two or more states in your profile levy their own estate tax. Without clear domicile
            establishment, your estate could face state-level estate taxes in multiple
            jurisdictions. An estate planning attorney can help resolve this.
          </p>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-medium text-gray-900">Key recommendations</h2>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="mt-0.5 shrink-0 text-blue-500">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-medium text-gray-900">State tax comparison</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-700">State</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Income tax</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Estate tax</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Threshold</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Inheritance tax</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Notes</th>
              </tr>
            </thead>
            <tbody>
              {involvedStates.map((state, i) => {
                const tax = STATE_TAX_DATA[state]
                if (!tax) return null
                const isClaimed = state === analysis.claimed_domicile_state
                return (
                  <tr
                    key={state}
                    className={`border-b border-gray-100 ${isClaimed ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {state}
                      {isClaimed && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                          claimed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{tax.income_tax}</td>
                    <td className="px-4 py-3">
                      {tax.estate_tax ? (
                        <span className="font-medium text-red-600">Yes</span>
                      ) : (
                        <span className="text-green-600">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{tax.estate_threshold ?? '—'}</td>
                    <td className="px-4 py-3">
                      {tax.inheritance_tax ? (
                        <span className="font-medium text-red-600">Yes</span>
                      ) : (
                        <span className="text-green-600">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{tax.notes ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(score > 65 || hasDualEstateTax) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <p className="mb-1 text-sm font-medium text-blue-900">
            Consider consulting an estate planning attorney
          </p>
          <p className="mb-3 text-sm text-blue-700">
            Your domicile profile has complexity that benefits from professional legal guidance. An
            attorney can help establish clear domicile, reduce double-taxation risk, and update your
            estate documents.
          </p>
          <Link
            href="/referrals"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Find an estate planning attorney
          </Link>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onViewChecklist}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          View action checklist
        </button>
        <button
          type="button"
          onClick={onRerun}
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Update inputs
        </button>
      </div>
    </div>
  )
}
