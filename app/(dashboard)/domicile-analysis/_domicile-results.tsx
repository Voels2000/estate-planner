'use client'

import Link from 'next/link'

import type {
  DomicileAnalysisRow,
  StateEstateTaxRule,
  StateInheritanceTaxRule,
  StateIncomeTaxBracket,
  StateWithDays,
} from './types'

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
  stateEstateTaxRules: StateEstateTaxRule[]
  stateInheritanceTaxRules: StateInheritanceTaxRule[]
  stateIncomeTaxBrackets: StateIncomeTaxBracket[]
}

export default function DomicileResults({
  analysis,
  onRerun,
  onViewChecklist,
  stateEstateTaxRules,
  stateInheritanceTaxRules,
  stateIncomeTaxBrackets,
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

  const latestEstateTaxYear = Math.max(
    ...stateEstateTaxRules.map((r) => r.tax_year),
    0
  )
  const estateTaxByState = Object.fromEntries(
    stateEstateTaxRules
      .filter((r) => r.tax_year === latestEstateTaxYear)
      .map((r) => [r.state, r])
  )

  const latestInheritanceYear = Math.max(
    ...stateInheritanceTaxRules.map((r) => r.tax_year),
    0
  )
  const inheritanceTaxStates = new Set(
    stateInheritanceTaxRules
      .filter((r) => r.tax_year === latestInheritanceYear)
      .map((r) => r.state)
  )

  const latestIncomeTaxYear = Math.max(...stateIncomeTaxBrackets.map((r) => r.tax_year), 0)
  const incomeTaxByState = Object.fromEntries(
    Array.from(
      new Set(
        stateIncomeTaxBrackets
          .filter((r) => r.tax_year === latestIncomeTaxYear)
          .map((r) => r.state),
      ),
    ).map((state) => {
      const stateRows = stateIncomeTaxBrackets
        .filter((r) => r.tax_year === latestIncomeTaxYear && r.state === state)
        .sort((a, b) => a.rate_pct - b.rate_pct)
      const topRate = stateRows.length > 0 ? stateRows[stateRows.length - 1].rate_pct : null
      return [state, topRate]
    }),
  )

  const hasDualEstateTax =
    involvedStates.filter((s) => !!estateTaxByState[s]).length >= 2

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
        <h2 className="mb-3 text-base font-medium text-gray-900">State tax comparison (income vs estate)</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-700">State</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">State income tax</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">State estate tax</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Threshold</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Inheritance tax</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Notes</th>
              </tr>
            </thead>
            <tbody>
              {involvedStates.map((state, i) => {
                const estateTax = estateTaxByState[state]
                const hasEstateTax = !!estateTax
                const threshold = estateTax
                  ? `$${(estateTax.exemption_amount / 1_000_000).toFixed(2)}M`
                  : null
                const hasInheritanceTax = inheritanceTaxStates.has(state)
                const incomeTaxRate = incomeTaxByState[state]
                const incomeTaxDisplay = incomeTaxRate != null ? (incomeTaxRate === 0 ? 'None' : `Up to ${incomeTaxRate}%`) : '—'
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
                    <td className="px-4 py-3 text-gray-700">{incomeTaxDisplay}</td>
                    <td className="px-4 py-3">
                      {hasEstateTax ? (
                        <span className="font-medium text-red-600">Yes</span>
                      ) : (
                        <span className="text-green-600">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{threshold ?? '—'}</td>
                    <td className="px-4 py-3">
                      {hasInheritanceTax ? (
                        <span className="font-medium text-red-600">Yes</span>
                      ) : (
                        <span className="text-green-600">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">—</td>
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
