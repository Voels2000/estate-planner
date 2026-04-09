'use client'

import { useState } from 'react'
import {
  calculateInheritanceTax,
  type InheritanceTaxCode,
} from '@/lib/projection/stateRegistry'

const INHERITANCE_STATES: InheritanceTaxCode[] = ['PA', 'NJ', 'KY', 'NE', 'IA', 'MD']

const STATE_NAMES: Record<InheritanceTaxCode, string> = {
  PA: 'Pennsylvania',
  NJ: 'New Jersey',
  KY: 'Kentucky',
  NE: 'Nebraska',
  IA: 'Iowa',
  MD: 'Maryland',
}

interface Props {
  inheritanceAmount: number
  year?: number
  beneficiaryType?: 'lineal' | 'sibling' | 'other'
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function InheritanceTaxWaterfall({
  inheritanceAmount,
  year = 2026,
  beneficiaryType = 'lineal',
}: Props) {
  const [activeBeneficiaryType, setActiveBeneficiaryType] =
    useState<'lineal' | 'sibling' | 'other'>(beneficiaryType)

  const activeResults = INHERITANCE_STATES.map(state =>
    calculateInheritanceTax({
      state,
      beneficiaryType: activeBeneficiaryType,
      inheritanceAmount,
      year,
    })
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Inheritance Tax by State</h3>
        <span className="text-xs text-slate-400">6 inheritance tax states · {year}</span>
      </div>

      <div className="flex gap-2">
        {(['lineal', 'sibling', 'other'] as const).map(type => (
          <button
            key={type}
            onClick={() => setActiveBeneficiaryType(type)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
              activeBeneficiaryType === type
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {type === 'lineal' ? 'Lineal Heirs' : type === 'sibling' ? 'Siblings' : 'Others'}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Based on inheritance of {fmt(inheritanceAmount)}.
        Lineal heirs = spouse, children, grandchildren.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-xs font-semibold text-slate-500 pb-2">State</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">Rate</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">Tax Due</th>
              <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {activeResults.map(result => (
              <tr key={result.state} className="hover:bg-slate-50">
                <td className="py-2.5 font-medium text-slate-800">
                  {STATE_NAMES[result.state]}
                  <span className="ml-1.5 text-xs text-slate-400">({result.state})</span>
                </td>
                <td className="py-2.5 text-right text-slate-600">
                  {result.taxRate === 0 ? (
                    <span className="text-emerald-600">Exempt</span>
                  ) : (
                    `${(result.taxRate * 100).toFixed(1)}%`
                  )}
                </td>
                <td className="py-2.5 text-right font-semibold">
                  {result.taxDue === 0 ? (
                    <span className="text-emerald-700">$0</span>
                  ) : (
                    <span className="text-red-700">{fmt(result.taxDue)}</span>
                  )}
                </td>
                <td className="py-2.5 pl-4 text-xs text-slate-400 max-w-xs">
                  {result.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Inheritance tax is paid by the beneficiary, not the estate.
        Rates shown are starting rates; actual rates may vary by amount and specific relationship.
      </p>
    </div>
  )
}
