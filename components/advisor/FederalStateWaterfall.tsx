'use client'

import type { DbStateExemption, StateTaxCode } from '@/lib/projection/stateRegistry'
import {
  getEstateTaxDisplayStateName,
} from '@/lib/projection/stateRegistry'
import {
  calculateStateEstateTax as calculateUnifiedStateEstateTax,
  type StateBracket,
  getPortabilityGapLabel,
} from '@/lib/calculations/stateEstateTax'

interface Props {
  grossEstate: number
  federalTax: number
  federalExemption: number
  stateCode: StateTaxCode
  /** Profile `state_primary` — full state name in labels when modeled code is `other`. */
  profileStateAbbrev?: string | null
  year: number
  dsue?: number
  /** Legacy prop kept for compatibility with existing tab callers. */
  dbExemptions?: DbStateExemption[]
  scenarioLabel?: string
  stateAbbrev?: string | null
  stateEstateTaxRules?: Array<{
    state: string
    tax_year: number
    min_amount: number
    max_amount: number
    rate_pct: number
    exemption_amount: number
  }>
  isMFJ?: boolean
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(n: number, total: number) {
  if (total === 0) return '0.0%'
  return ((n / total) * 100).toFixed(1) + '%'
}

export default function FederalStateWaterfall({
  grossEstate,
  federalTax,
  federalExemption,
  stateCode,
  profileStateAbbrev,
  year,
  dsue = 0,
  scenarioLabel = 'Current Law',
  stateAbbrev,
  stateEstateTaxRules,
  isMFJ = false,
}: Props) {
  const stateDisplayName = getEstateTaxDisplayStateName(stateCode, profileStateAbbrev)
  const unifiedStateCode = (stateAbbrev ?? '').toUpperCase()
  const hasUnifiedRules =
    !!unifiedStateCode &&
    (stateEstateTaxRules ?? []).some((r) => r.state.toUpperCase() === unifiedStateCode)
  const stateRulesForYear = hasUnifiedRules
    ? (
      stateEstateTaxRules
        ?.filter((r) => r.tax_year === year)
        .map((r) => ({
          min_amount: Number(r.min_amount ?? 0),
          max_amount: Number(r.max_amount ?? 9_999_999_999),
          rate_pct: Number(r.rate_pct ?? 0),
          exemption_amount: Number(r.exemption_amount ?? 0),
        })) ?? []
    )
    : []
  const fallbackRules = hasUnifiedRules
    ? (
      [...(stateEstateTaxRules ?? [])]
        .sort((a, b) => b.tax_year - a.tax_year)
        .slice(0, 1)
        .map((r) => ({
          min_amount: Number(r.min_amount ?? 0),
          max_amount: Number(r.max_amount ?? 9_999_999_999),
          rate_pct: Number(r.rate_pct ?? 0),
          exemption_amount: Number(r.exemption_amount ?? 0),
        })) ?? []
    )
    : []
  const unifiedBrackets: StateBracket[] = stateRulesForYear.length > 0 ? stateRulesForYear : fallbackRules
  const unifiedStateResult = hasUnifiedRules && unifiedBrackets.length > 0
    ? calculateUnifiedStateEstateTax(grossEstate, unifiedStateCode, unifiedBrackets, isMFJ)
    : null
  const stateResult = {
    stateTax: unifiedStateResult?.stateTax ?? 0,
    nyCliffTriggered: unifiedStateResult?.nyCliffTriggered ?? false,
  }
  const stateExemption = unifiedStateResult
    ? (unifiedBrackets[0]?.exemption_amount ?? 0)
    : 0

  const totalTax = federalTax + stateResult.stateTax
  const netToHeirs = Math.max(0, grossEstate - totalTax)
  const totalTaxPct = grossEstate > 0 ? (totalTax / grossEstate) * 100 : 0

  const bars = [
    {
      label: 'Net to Heirs',
      value: netToHeirs,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-700',
    },
    {
      label: 'Federal Estate Tax',
      value: federalTax,
      color: 'bg-red-400',
      textColor: 'text-red-700',
    },
    {
      label: `${stateDisplayName} Estate Tax`,
      value: stateResult.stateTax,
      color: 'bg-orange-400',
      textColor: 'text-orange-700',
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Combined Federal + State Waterfall
        </h3>
        <span className="text-xs text-slate-400">{scenarioLabel} · {year}</span>
      </div>

      {stateResult.nyCliffTriggered && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-800">
          ⚠ NY Cliff triggered — full estate taxable at state level
        </div>
      )}
      {unifiedStateResult && getPortabilityGapLabel(unifiedStateCode) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-800">
          {getPortabilityGapLabel(unifiedStateCode)}
        </div>
      )}

      <div className="space-y-2">
        {bars.map(bar => {
          const widthPct = grossEstate > 0 ? Math.max(0, (bar.value / grossEstate) * 100) : 0
          return (
            <div key={bar.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">{bar.label}</span>
                <span className={`font-semibold ${bar.textColor}`}>
                  {fmt(bar.value)} ({pct(bar.value, grossEstate)})
                </span>
              </div>
              <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${bar.color} transition-all`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-50">
            <tr>
              <td className="py-2 text-slate-600">Gross Estate</td>
              <td className="py-2 text-right font-medium text-slate-800">{fmt(grossEstate)}</td>
            </tr>
            <tr>
              <td className="py-2 text-slate-600">Federal Exemption</td>
              <td className="py-2 text-right text-slate-500">({fmt(federalExemption + dsue)})</td>
            </tr>
            <tr>
              <td className="py-2 text-slate-600">Federal Estate Tax</td>
              <td className="py-2 text-right text-red-700 font-medium">{fmt(federalTax)}</td>
            </tr>
            <tr>
              <td className="py-2 text-slate-600">{stateDisplayName} Exemption</td>
              <td className="py-2 text-right text-slate-500">
                ({isFinite(stateExemption) ? fmt(stateExemption) : 'No state tax'})
              </td>
            </tr>
            <tr>
              <td className="py-2 text-slate-600">{stateDisplayName} Estate Tax</td>
              <td className="py-2 text-right text-orange-700 font-medium">{fmt(stateResult.stateTax)}</td>
            </tr>
            <tr className="border-t-2 border-slate-200">
              <td className="py-2 font-semibold text-slate-800">Total Tax Burden</td>
              <td className="py-2 text-right font-bold text-red-800">
                {fmt(totalTax)} ({totalTaxPct.toFixed(1)}%)
              </td>
            </tr>
            <tr>
              <td className="py-2 font-semibold text-emerald-800">Net to Heirs</td>
              <td className="py-2 text-right font-bold text-emerald-700">{fmt(netToHeirs)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {unifiedStateResult
          ? `${stateDisplayName} state tax uses the unified live bracket engine.`
          : `${stateDisplayName} state tax unavailable for selected year/rules.`
        } Consult a qualified estate attorney for precise calculations.
      </p>
    </div>
  )
}
