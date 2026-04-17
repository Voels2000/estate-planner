'use client'

import React, { useRef, useEffect, useState } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { OBBBA_2026 } from '@/lib/tax/estate-tax-constants'

const ASSET_MIDPOINTS: Record<string, number> = {
  sm: 3_000_000,
  md: 10_000_000,
  lg: 22_500_000,
  xl: 40_000_000,
}

const ASSET_LABELS: Record<string, string> = {
  sm: '$1M – $5M',
  md: '$5M – $15M',
  lg: '$15M – $30M',
  xl: '$30M+',
}

const ESTATE_TAX_STATES = ['CT', 'HI', 'IL', 'ME', 'MD', 'MA', 'MN', 'NY', 'OR', 'RI', 'VT', 'WA', 'DC']
const STATE_EXEMPTIONS: Record<string, number> = {
  CT: 12920000, HI: 5490000, IL: 4000000, ME: 6800000, MD: 5000000, MA: 1000000,
  MN: 3000000, NY: 6940000, OR: 1000000, RI: 1733264, VT: 5000000, WA: 2193000, DC: 4528800,
}
const STATE_TOP_RATES: Record<string, number> = {
  CT: 0.12, HI: 0.20, IL: 0.16, ME: 0.12, MD: 0.16, MA: 0.16,
  MN: 0.16, NY: 0.16, OR: 0.16, RI: 0.16, VT: 0.16, WA: 0.20, DC: 0.16,
}
const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

export default function ProspectModePage() {
  const stateRef = useRef<HTMLSelectElement>(null)
  const assetRef = useRef<HTMLSelectElement>(null)
  const maritalRef = useRef<HTMLSelectElement>(null)
  const bizRef = useRef<HTMLInputElement>(null)
  const ageRef = useRef<HTMLInputElement>(null)
  const [ageDisplay, setAgeDisplay] = useState(55)

  const [result, setResult] = useState<null | {
    federal_tax_current: number
    state_tax_estimate: number
    selectedState: string
    planning_gaps: string[]
    what_we_would_look_at: string[]
  }>(null)

  useEffect(() => {
    const ageEl = ageRef.current
    if (!ageEl) return
    const handler = () => setAgeDisplay(parseInt(ageEl.value))
    ageEl.addEventListener('input', handler)
    return () => ageEl.removeEventListener('input', handler)
  }, [])

  const handleCalculate = () => {
    const state = stateRef.current?.value ?? 'CA'
    const assetRange = assetRef.current?.value ?? 'md'
    const maritalStatus = maritalRef.current?.value ?? 'married'
    const businessOwner = bizRef.current?.checked ?? false
    const age = parseInt(ageRef.current?.value ?? '55')

    console.log('Calculate:', { state, assetRange, maritalStatus, businessOwner, age })

    const assets = ASSET_MIDPOINTS[assetRange] ?? 10_000_000
    const exemptionCurrent = maritalStatus === 'married'
      ? OBBBA_2026.BASIC_EXCLUSION_MFJ
      : OBBBA_2026.BASIC_EXCLUSION_SINGLE

    const taxableCurrent = Math.max(0, assets - exemptionCurrent)
    const federalTaxCurrent = Math.round(taxableCurrent * OBBBA_2026.TOP_RATE)

    let stateTaxEstimate = 0
    if (ESTATE_TAX_STATES.includes(state)) {
      const stateExemption = STATE_EXEMPTIONS[state] ?? 2_000_000
      const stateTopRate = STATE_TOP_RATES[state] ?? 0.16
      stateTaxEstimate = Math.round(Math.max(0, assets - stateExemption) * stateTopRate)
    }

    const planningGaps: string[] = []
    if (assets > exemptionCurrent) planningGaps.push('Federal estate tax exposure above the $15M/$30M permanent exemption')
    if (maritalStatus === 'married' && assets > 5_000_000) planningGaps.push('Credit shelter trust opportunity at first death')
    if (businessOwner) planningGaps.push('Business succession and valuation planning needed')
    if (assets > 10_000_000) planningGaps.push('Annual gifting program could reduce estate over time')
    if (ESTATE_TAX_STATES.includes(state)) planningGaps.push(`${state} state estate tax applies — separate from federal`)
    if (age > 60) planningGaps.push('Beneficiary designation review recommended')

    const lookAt: string[] = [
      'Review all beneficiary designations and account titling',
      'Analyze federal and state estate tax exposure under OBBBA 2026 law',
    ]
    if (maritalStatus === 'married') lookAt.push('Evaluate portability election and credit shelter trust')
    if (assets > 10_000_000) lookAt.push('Annual gifting program and lifetime exemption utilization')
    if (businessOwner) lookAt.push('Business succession plan and valuation discount strategies')
    if (ESTATE_TAX_STATES.includes(state)) lookAt.push(`${state} state estate tax mitigation strategies`)

    setResult({
      federal_tax_current: federalTaxCurrent,
      state_tax_estimate: stateTaxEstimate,
      selectedState: state,
      planning_gaps: planningGaps.slice(0, 5),
      what_we_would_look_at: lookAt.slice(0, 6),
    })
  }

  return (
    <div style={{ minHeight: '150vh' }}>
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Prospect Mode</h1>
      <p className="text-sm text-neutral-500 mb-6">Generate an Estate Planning Opportunity Summary. No data is stored.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">State</label>
            <select
              ref={stateRef}
              defaultValue="CA"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
            >
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Approximate total assets</label>
            <select
              ref={assetRef}
              defaultValue="md"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
            >
              {Object.entries(ASSET_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Marital status</label>
            <select
              ref={maritalRef}
              defaultValue="married"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={bizRef}
              type="checkbox"
              id="biz"
              className="w-4 h-4 rounded border-neutral-300"
            />
            <label htmlFor="biz" className="text-sm text-neutral-700">Business owner</label>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Age: {ageDisplay}
            </label>
            <input
              ref={ageRef}
              type="range"
              min="35"
              max="85"
              defaultValue="55"
              className="w-full"
            />
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            className="w-full py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition"
          >
            Generate Summary
          </button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Estate Planning Opportunity Summary</h2>
              <button
                type="button"
                onClick={() => window.print()}
                className="text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg"
              >
                Print / PDF
              </button>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-2">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Federal Estate Tax</h3>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Current law</span>
                <span className="font-semibold">{fmt(result.federal_tax_current)}</span>
              </div>
              {result.state_tax_estimate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{result.selectedState} state estate tax</span>
                  <span className="font-semibold text-amber-700">{fmt(result.state_tax_estimate)}</span>
                </div>
              )}
            </div>

            {result.planning_gaps.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Top Planning Gaps</h3>
                <div className="space-y-2">
                  {result.planning_gaps.map((gap, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 shrink-0">○</span>
                      <span className="text-sm text-neutral-700">{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
              <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">What we would look at together</h3>
              <div className="space-y-2">
                {result.what_we_would_look_at.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-indigo-400 font-bold text-xs mt-0.5">{i + 1}.</span>
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
