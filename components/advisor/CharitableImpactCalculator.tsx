// Sprint 62 — Charitable Impact Calculator
// Computes: income tax deduction PV, estate tax savings, 20-year charitable impact.
// Gift types: outright_gift, daf_contribution, crt.
// Consumer-facing simplified version shows 3 numbers prominently.
// Full advisor version shows detailed calculation.

'use client'

import React, { useState } from 'react'
import type { GiftType, CharitableImpactResult } from '@/lib/analytics/bookOfBusiness'
import { calculateCharitableImpact } from '@/lib/analytics/bookOfBusiness'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

const GIFT_TYPE_LABELS: Record<GiftType, string> = {
  outright_gift: 'Outright Gift',
  daf_contribution: 'Donor Advised Fund (DAF)',
  crt: 'Charitable Remainder Trust (CRT)',
}

const GIFT_TYPE_DESCRIPTIONS: Record<GiftType, string> = {
  outright_gift: 'An immediate gift to a charity of your choice. Simplest structure, immediate deduction.',
  daf_contribution: 'Contribute to a donor advised fund for an immediate deduction, then recommend grants over time.',
  crt: 'Transfer assets to a trust that pays you income for life or a term, with the remainder going to charity.',
}

// ─── Main calculator ──────────────────────────────────────────────────────────

interface Props {
  householdId: string
  effectiveEstateTaxRate?: number
  isAdvisor?: boolean
}

export default function CharitableImpactCalculator({
  householdId,
  effectiveEstateTaxRate = 0.40,
  isAdvisor = false,
}: Props) {
  const [giftAmount, setGiftAmount] = useState<string>('100000')
  const [giftType, setGiftType] = useState<GiftType>('outright_gift')
  const [incomeTaxRate, setIncomeTaxRate] = useState<string>('37')
  const [result, setResult] = useState<CharitableImpactResult | null>(null)
  const [calculated, setCalculated] = useState(false)

  const handleCalculate = () => {
    const amount = parseFloat(giftAmount.replace(/[^0-9.]/g, ''))
    const incomeRate = parseFloat(incomeTaxRate) / 100
    if (isNaN(amount) || amount <= 0) return

    const r = calculateCharitableImpact(
      householdId,
      amount,
      giftType,
      effectiveEstateTaxRate,
      incomeRate,
    )
    setResult(r)
    setCalculated(true)
  }

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gift amount */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">
            Gift amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
            <input
              type="text"
              value={giftAmount}
              onChange={e => setGiftAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-indigo-400"
              placeholder="100,000"
            />
          </div>
        </div>

        {/* Income tax rate (advisor only) */}
        {isAdvisor && (
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Effective income tax rate
            </label>
            <div className="relative">
              <input
                type="number"
                value={incomeTaxRate}
                onChange={e => setIncomeTaxRate(e.target.value)}
                min="0"
                max="60"
                className="w-full pr-8 pl-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-indigo-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">%</span>
            </div>
          </div>
        )}
      </div>

      {/* Gift type selector */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-2">Gift structure</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(Object.keys(GIFT_TYPE_LABELS) as GiftType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setGiftType(type)}
              className={`px-3 py-2.5 rounded-xl border text-left transition ${
                giftType === type
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
              }`}
            >
              <div className="text-xs font-semibold">{GIFT_TYPE_LABELS[type]}</div>
              <div className="text-xs text-neutral-500 mt-0.5 leading-tight">
                {GIFT_TYPE_DESCRIPTIONS[type]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Calculate button */}
      <button
        type="button"
        onClick={handleCalculate}
        className="w-full py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition"
      >
        Calculate impact
      </button>

      {/* Results */}
      {calculated && result && (
        <div className="space-y-4">
          {/* 3 key numbers */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Income tax deduction',
                value: fmt(result.income_tax_deduction_pv),
                sub: 'Present value',
                color: 'text-green-700',
                bg: 'bg-green-50 border-green-200',
              },
              {
                label: 'Estate tax savings',
                value: fmt(result.estate_tax_savings),
                sub: 'Removed from estate',
                color: 'text-blue-700',
                bg: 'bg-blue-50 border-blue-200',
              },
              {
                label: 'Charitable impact',
                value: fmt(result.charitable_impact_20yr),
                sub: 'vs. waiting 20 yrs',
                color: 'text-indigo-700',
                bg: 'bg-indigo-50 border-indigo-200',
              },
            ].map(item => (
              <div key={item.label} className={`px-3 py-3 rounded-xl border ${item.bg} text-center`}>
                <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs font-medium text-neutral-700 mt-0.5">{item.label}</div>
                <div className="text-xs text-neutral-500">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Net cost (advisor detail) */}
          {isAdvisor && (
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                Detailed calculation — {GIFT_TYPE_LABELS[giftType]}
              </h4>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Gift amount', value: fmt(result.gift_amount) },
                  { label: 'Income tax deduction (PV)', value: fmt(result.income_tax_deduction_pv), green: true },
                  { label: 'Estate tax savings', value: fmt(result.estate_tax_savings), green: true },
                  { label: 'Net cost to donor', value: fmt(result.net_cost_to_donor), divider: true },
                  { label: 'Charitable impact over 20 years', value: fmt(result.charitable_impact_20yr), blue: true },
                ].map(item => (
                  <div key={item.label}>
                    {item.divider && <div className="border-t border-neutral-200 my-2" />}
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">{item.label}</span>
                      <span className={`font-semibold ${item.green ? 'text-green-700' : item.blue ? 'text-blue-700' : 'text-neutral-900'}`}>
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DisclaimerBanner context="charitable planning" />
        </div>
      )}
    </div>
  )
}
