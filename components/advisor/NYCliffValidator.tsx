'use client'

import { useMemo } from 'react'
import { type DbStateExemption } from '@/lib/projection/stateRegistry'
import { calculateStateEstateTax, type StateBracket } from '@/lib/calculations/stateEstateTax'

interface Props {
  year: number
  dbExemptions?: DbStateExemption[]
  stateEstateTaxRules?: Array<{
    state: string
    tax_year: number
    min_amount: number
    max_amount: number
    rate_pct: number
    exemption_amount: number
  }>
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function NYCliffValidator({ year, dbExemptions, stateEstateTaxRules }: Props) {
  const bracketsForYear = useMemo<StateBracket[]>(() => {
    const fromRules = (stateEstateTaxRules ?? [])
      .filter((r) => r.state === 'NY' && r.tax_year === year)
      .map((r) => ({
        min_amount: Number(r.min_amount ?? 0),
        max_amount: Number(r.max_amount ?? 9_999_999_999),
        rate_pct: Number(r.rate_pct ?? 0),
        exemption_amount: Number(r.exemption_amount ?? 0),
      }))
    if (fromRules.length > 0) return fromRules
    const fromDb = (dbExemptions ?? []).find((r) => r.state === 'NY' && r.tax_year === year)
    if (!fromDb) return []
    return [{
      min_amount: 0,
      max_amount: 9_999_999_999,
      rate_pct: Number(fromDb.top_rate ?? 0) * 100,
      exemption_amount: Number(fromDb.exemption_amount ?? 0),
    }]
  }, [stateEstateTaxRules, dbExemptions, year])

  const results = useMemo(
    () => {
      const exemption = bracketsForYear[0]?.exemption_amount ?? 0
      if (exemption <= 0) return []
      const cases = [
        { label: '100% of exemption', estateAsMultiple: 1.00, expectedCliff: false },
        { label: '104% of exemption', estateAsMultiple: 1.04, expectedCliff: false },
        { label: '105% of exemption', estateAsMultiple: 1.05, expectedCliff: false },
        { label: '106% of exemption', estateAsMultiple: 1.06, expectedCliff: true },
        { label: '150% of exemption', estateAsMultiple: 1.50, expectedCliff: true },
        { label: '200% of exemption', estateAsMultiple: 2.00, expectedCliff: true },
      ]
      return cases.map((tc) => {
        const estate = Math.round(exemption * tc.estateAsMultiple)
        const actual = calculateStateEstateTax(estate, 'NY', bracketsForYear, false).nyCliffTriggered
        return {
          label: tc.label,
          passed: actual === tc.expectedCliff,
          expected: tc.expectedCliff,
          actual,
          estate,
        }
      })
    },
    [bracketsForYear]
  )

  const allPassed = results.every(r => r.passed)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">NY Cliff Edge Case Validation</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}>
          {allPassed ? '✓ All cases pass' : `${results.filter(r => !r.passed).length} failing`}
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left text-xs font-semibold text-slate-500 pb-2">Case</th>
            <th className="text-right text-xs font-semibold text-slate-500 pb-2">Estate</th>
            <th className="text-center text-xs font-semibold text-slate-500 pb-2">Expected Cliff</th>
            <th className="text-center text-xs font-semibold text-slate-500 pb-2">Actual</th>
            <th className="text-center text-xs font-semibold text-slate-500 pb-2">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {results.map(r => (
            <tr key={r.label} className={`hover:bg-slate-50 ${!r.passed ? 'bg-red-50' : ''}`}>
              <td className="py-2.5 text-slate-700">{r.label}</td>
              <td className="py-2.5 text-right text-slate-500">{fmt(r.estate)}</td>
              <td className="py-2.5 text-center">
                {r.expected
                  ? <span className="text-red-600 font-medium">Yes</span>
                  : <span className="text-slate-400">No</span>}
              </td>
              <td className="py-2.5 text-center">
                {r.actual
                  ? <span className="text-red-600 font-medium">Yes</span>
                  : <span className="text-slate-400">No</span>}
              </td>
              <td className="py-2.5 text-center">
                {r.passed
                  ? <span className="text-emerald-600">✓</span>
                  : <span className="text-red-600 font-bold">✗</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-slate-400">
        NY cliff triggers when estate exceeds 105% of exemption. At that point
        the entire estate is taxable with no exemption offset.
      </p>
    </div>
  )
}
