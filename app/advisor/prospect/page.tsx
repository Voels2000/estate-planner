// Sprint 62 — Advisor Prospect Mode
// Quick estate health check for a prospect without requiring a platform account.
// Generates a one-page Estate Planning Opportunity Summary PDF.
// No actual client data stored.

'use client'

import React, { useRef, useState } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetRange = '$1M-$5M' | '$5M-$15M' | '$15M-$30M' | '$30M+'
type MaritalStatus = 'single' | 'married'

interface ProspectInputs {
  state: string
  assetRange: AssetRange
  maritalStatus: MaritalStatus
  businessOwner: boolean
  approximateAge: number
}

interface ProspectResult {
  federal_tax_current: number
  federal_tax_sunset: number
  sunset_delta: number
  state_tax_estimate: number
  planning_gaps: string[]
  what_we_would_look_at: string[]
}

// ─── Estate tax states ────────────────────────────────────────────────────────

const ESTATE_TAX_STATES = [
  'CT', 'HI', 'IL', 'ME', 'MD', 'MA', 'MN', 'NY', 'OR', 'RI', 'VT', 'WA', 'DC'
]

const STATE_EXEMPTIONS: Record<string, number> = {
  CT: 12920000, HI: 5490000, IL: 4000000, ME: 6800000,
  MD: 5000000, MA: 1000000, MN: 3000000, NY: 6940000,
  OR: 1000000, RI: 1733264, VT: 5000000, WA: 2193000, DC: 4528800,
}

const STATE_TOP_RATES: Record<string, number> = {
  CT: 0.12, HI: 0.20, IL: 0.16, ME: 0.12, MD: 0.16, MA: 0.16,
  MN: 0.16, NY: 0.16, OR: 0.16, RI: 0.16, VT: 0.16, WA: 0.20, DC: 0.16,
}

// ─── Asset range midpoints ────────────────────────────────────────────────────

const ASSET_MIDPOINTS: Record<AssetRange, number> = {
  '$1M-$5M': 3_000_000,
  '$5M-$15M': 10_000_000,
  '$15M-$30M': 22_500_000,
  '$30M+': 40_000_000,
}

// ─── Prospect calculator ──────────────────────────────────────────────────────

function calculateProspectResult(inputs: ProspectInputs): ProspectResult {
  const assets = ASSET_MIDPOINTS[inputs.assetRange]
  const exemptionCurrent = inputs.maritalStatus === 'married' ? 27_220_000 : 13_610_000
  const exemptionSunset = inputs.maritalStatus === 'married' ? 7_200_000 * 2 : 7_200_000
  const topRate = 0.40

  // Federal tax current
  const taxableCurrent = Math.max(0, assets - exemptionCurrent)
  const federalTaxCurrent = Math.round(taxableCurrent * topRate)

  // Federal tax sunset
  const taxableSunset = Math.max(0, assets - exemptionSunset)
  const federalTaxSunset = Math.round(taxableSunset * topRate)
  console.log('Prospect calc:', { assets, exemptionCurrent, exemptionSunset, taxableSunset, federalTaxSunset })

  const sunsetDelta = federalTaxSunset - federalTaxCurrent

  // State tax estimate
  let stateTaxEstimate = 0
  if (ESTATE_TAX_STATES.includes(inputs.state)) {
    const stateExemption = STATE_EXEMPTIONS[inputs.state] ?? 2_000_000
    const stateTopRate = STATE_TOP_RATES[inputs.state] ?? 0.16
    const taxableState = Math.max(0, assets - stateExemption)
    stateTaxEstimate = Math.round(taxableState * stateTopRate)
  }

  // Planning gaps based on profile
  const planningGaps: string[] = []
  if (assets > exemptionSunset) planningGaps.push('Potential estate tax exposure under sunset scenario')
  if (inputs.maritalStatus === 'married' && assets > 5_000_000) planningGaps.push('Credit shelter trust opportunity at first death')
  if (inputs.businessOwner) planningGaps.push('Business succession and valuation planning needed')
  if (assets > 10_000_000) planningGaps.push('Annual gifting program could reduce estate over time')
  if (ESTATE_TAX_STATES.includes(inputs.state)) planningGaps.push(`${inputs.state} state estate tax applies — separate from federal`)
  if (inputs.approximateAge > 60) planningGaps.push('Beneficiary designation review recommended')

  // What we would look at
  const lookAt: string[] = [
    'Review all beneficiary designations and account titling',
    'Analyze federal and state estate tax exposure under current and sunset law',
  ]
  if (inputs.maritalStatus === 'married') lookAt.push('Evaluate portability election and credit shelter trust')
  if (assets > 10_000_000) lookAt.push('Annual gifting program and lifetime exemption utilization')
  if (inputs.businessOwner) lookAt.push('Business succession plan and valuation discount strategies')
  if (sunsetDelta > 500_000) lookAt.push('Sunset planning window — strategies available before December 31, 2025')
  if (ESTATE_TAX_STATES.includes(inputs.state)) lookAt.push(`${inputs.state} state estate tax mitigation strategies`)

  return {
    federal_tax_current: federalTaxCurrent,
    federal_tax_sunset: federalTaxSunset,
    sunset_delta: sunsetDelta,
    state_tax_estimate: stateTaxEstimate,
    planning_gaps: planningGaps.slice(0, 5),
    what_we_would_look_at: lookAt.slice(0, 6),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProspectModePage() {
  const assetRangeRef = useRef<HTMLSelectElement>(null)
  const [result, setResult] = useState<ProspectResult | null>(null)
  const [calculatedInputs, setCalculatedInputs] = useState<ProspectInputs | null>(null)
  const [calculated, setCalculated] = useState(false)

  const handleCalculate = () => {
    const assetRange = (assetRangeRef.current?.value ??
      (document.getElementById('assetRange') as HTMLSelectElement).value) as AssetRange
    const maritalStatus = (document.getElementById('maritalStatus') as HTMLSelectElement).value as MaritalStatus
    const businessOwner = (document.getElementById('businessOwner') as HTMLInputElement).checked
    const state = (document.getElementById('state') as HTMLSelectElement).value
    const age = parseInt((document.getElementById('age') as HTMLInputElement).value)

    console.log('Calculate clicked:', { assetRange, maritalStatus, state })

    const amount = ASSET_MIDPOINTS[assetRange]
    console.log('Asset midpoint:', amount)

    const inputs: ProspectInputs = {
      assetRange,
      maritalStatus,
      businessOwner,
      state,
      approximateAge: age,
    }
    setCalculatedInputs(inputs)
    setResult(calculateProspectResult(inputs))
    setCalculated(true)
  }

  const handlePrint = () => window.print()

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <a href="/advisor" className="text-sm text-indigo-600 hover:underline">
          ← Advisor Portal
        </a>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">Prospect Mode</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Generate an Estate Planning Opportunity Summary for a prospect — no account required.
          No prospect data is stored.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input form */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-neutral-900">Prospect Profile</h2>

          {/* State */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">State</label>
            <select
              defaultValue="CA"
              id="state"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-indigo-400"
            >
              {US_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Asset range */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Approximate total assets</label>
            <select
              defaultValue="$5M-$15M"
              id="assetRange"
              ref={assetRangeRef}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-indigo-400"
            >
              <option value="$1M-$5M">$1M – $5M</option>
              <option value="$5M-$15M">$5M – $15M</option>
              <option value="$15M-$30M">$15M – $30M</option>
              <option value="$30M+">$30M+</option>
            </select>
          </div>

          {/* Marital status */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Marital status</label>
            <select
              defaultValue="married"
              id="maritalStatus"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-indigo-400"
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
            </select>
          </div>

          {/* Business owner */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="businessOwner"
              defaultChecked={false}
              className="w-4 h-4 rounded border-neutral-300 text-indigo-600"
            />
            <label htmlFor="businessOwner" className="text-sm text-neutral-700">Business owner</label>
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Approximate age
            </label>
            <input
              type="range"
              id="age"
              min="35"
              max="85"
              defaultValue="55"
              className="w-full"
            />
            <div className="flex justify-between text-xs text-neutral-400 mt-1">
              <span>35</span><span>85</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            className="w-full py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition"
          >
            Generate Summary
          </button>
        </div>

        {/* Results */}
        {calculated && result && (
          <div className="space-y-4 print:space-y-3">
            <div className="flex items-center justify-between print:hidden">
              <h2 className="text-sm font-semibold text-neutral-900">Estate Planning Opportunity Summary</h2>
              <button
                type="button"
                onClick={handlePrint}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-3 py-1.5 rounded-lg"
              >
                Print / PDF
              </button>
            </div>

            {/* Tax estimates */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Federal Estate Tax Estimate</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Current law (extended)</span>
                  <span className="font-semibold text-neutral-900">{fmt(result.federal_tax_current)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Sunset scenario (2026)</span>
                  <span className="font-semibold text-amber-700">{fmt(result.federal_tax_sunset)}</span>
                </div>
                {result.sunset_delta > 0 && (
                  <div className="flex justify-between text-sm border-t border-neutral-100 pt-2">
                    <span className="text-neutral-700 font-medium">Additional tax under sunset</span>
                    <span className="font-bold text-red-600">{fmt(result.sunset_delta)}</span>
                  </div>
                )}
                {result.state_tax_estimate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">{calculatedInputs?.state ?? 'Selected'} state estate tax</span>
                    <span className="font-semibold text-amber-700">{fmt(result.state_tax_estimate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Planning gaps */}
            {result.planning_gaps.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Top Planning Gaps</h3>
                <div className="space-y-2">
                  {result.planning_gaps.map((gap, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 shrink-0 mt-0.5">○</span>
                      <span className="text-sm text-neutral-700">{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What we would look at */}
            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
              <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">
                What we would look at together
              </h3>
              <div className="space-y-2">
                {result.what_we_would_look_at.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-indigo-400 shrink-0 font-bold text-xs mt-0.5">{i + 1}.</span>
                    <span className="text-sm text-indigo-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <DisclaimerBanner context="prospect analysis" />
          </div>
        )}
      </div>
    </div>
  )
}
