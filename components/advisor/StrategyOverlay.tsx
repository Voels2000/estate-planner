'use client'

// Strategy Overlay UI
// Side-by-side comparison of base case vs strategy scenarios
// Renders in StrategyTab
// Net-to-heirs table at Today / +10 years / +20 years horizons
// Federal constants come from lib/tax/estate-tax-constants.ts (OBBBA 2026)

import { useState, useEffect } from 'react'
import { applyGiftingProgram, GiftingProgramConfig } from '@/lib/strategy/applyGiftingProgram'
import { applyCreditShelterTrust, CSTConfig } from '@/lib/strategy/applyCreditShelterTrust'
import { applyRevocableTrust, RevocableTrustConfig } from '@/lib/strategy/applyRevocableTrust'
import { OBBBA_2026, type EstateScenario, type FilingStatus } from '@/lib/tax/estate-tax-constants'
import type { ProjectionScenario } from '@/lib/types/projection-scenario'

type StrategyType = 'none' | 'gifting' | 'revocable_trust' | 'credit_shelter_trust'

interface StrategyOverlayProps {
  householdId: string
  grossEstate: number
  federalExemption: number
  person1BirthYear: number
  person2BirthYear?: number
  lawScenario: EstateScenario
  filingStatus: FilingStatus
  person1RetirementAge: number
  growthRateAccumulation: number
  growthRateRetirement: number
  giftingActuals?: {
    annualUsed: number
    annualCapacity: number
    lifetimeUsed: number
    lifetimeRemaining: number
    perRecipientLimit: number
    splitElected: boolean
    uniqueRecipients: number
  } | null
  projectionData?: Array<{
    year: number
    gross_estate: number
    federal_tax: number
    state_tax: number
  }>
  statePrimary?: string | null
}

const BASE_HORIZON_YEARS = [
  { label: 'Today', yearsFromNow: 0 },
  { label: 'In 10 Years', yearsFromNow: 10 },
  { label: 'In 20 Years', yearsFromNow: 20 },
]
const CURRENT_YEAR = new Date().getFullYear()
const EMPTY_PROJECTION_SCENARIO = {} as ProjectionScenario
const STATE_ESTATE_TAX_STATES = new Set([
  'CT', 'DC', 'HI', 'IL', 'ME', 'MD', 'MA', 'MN', 'NY', 'OR', 'RI', 'VT', 'WA',
])

function projectEstateBlended(
  grossEstate: number,
  yearsFromNow: number,
  person1BirthYear: number,
  person1RetirementAge: number,
  growthRateAccumulation: number,
  growthRateRetirement: number
): number {
  if (yearsFromNow <= 0) return grossEstate
  const accumRate = growthRateAccumulation / 100
  const retireRate = growthRateRetirement / 100
  const retirementYear = person1BirthYear + person1RetirementAge
  let value = grossEstate
  for (let i = 1; i <= yearsFromNow; i++) {
    const year = CURRENT_YEAR + i
    const rate = year >= retirementYear ? retireRate : accumRate
    value = value * (1 + rate)
  }
  return value
}

function calcNetToHeirs(
  estate: number,
  filingStatus: FilingStatus,
  lawScenario: EstateScenario,
): number {
  const exemption =
    lawScenario === 'no_exemption'
      ? 0
      : filingStatus === 'mfj'
        ? OBBBA_2026.BASIC_EXCLUSION_MFJ
        : OBBBA_2026.BASIC_EXCLUSION_SINGLE
  const taxable = Math.max(0, estate - exemption)
  return estate - taxable * OBBBA_2026.TOP_RATE
}

function useRecommendStrategy(householdId: string) {
  const [savedStrategies, setSavedStrategies] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!householdId) return
    fetch(`/api/strategy-configs?householdId=${householdId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setSavedStrategies(new Set(d.map((s: { strategy_type: string }) => s.strategy_type)))
      })
      .catch(() => null)
  }, [householdId])

  async function toggleRecommended(strategyType: string, label: string) {
    setSaving(true)
    const isActive = savedStrategies.has(strategyType)
    const method = isActive ? 'DELETE' : 'POST'
    await fetch('/api/strategy-configs', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, strategyType, label }),
    })
    setSavedStrategies((prev) => {
      const next = new Set(prev)
      if (isActive) next.delete(strategyType)
      else next.add(strategyType)
      return next
    })
    setSaving(false)
  }

  return { savedStrategies, saving, toggleRecommended }
}

export default function StrategyOverlay({
  householdId,
  grossEstate,
  federalExemption,
  person1BirthYear,
  person2BirthYear,
  lawScenario,
  filingStatus,
  person1RetirementAge,
  growthRateAccumulation,
  growthRateRetirement,
  giftingActuals,
  projectionData = [],
  statePrimary,
}: StrategyOverlayProps) {
  const { savedStrategies, saving, toggleRecommended } = useRecommendStrategy(householdId)

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('none')

  // Gifting config state — seeded from client actuals when available
  const [giftingConfig, setGiftingConfig] = useState<GiftingProgramConfig>({
    annualGiftPerDonor: giftingActuals?.perRecipientLimit ?? 19000,
    numberOfRecipients: giftingActuals?.uniqueRecipients ?? 2,
    startYear: CURRENT_YEAR,
    giftSplitting: giftingActuals?.splitElected ?? !!person2BirthYear,
  })

  useEffect(() => {
    if (!giftingActuals) return
    const timeoutId = window.setTimeout(() => {
      setGiftingConfig((prev) => ({
        ...prev,
        annualGiftPerDonor: giftingActuals.perRecipientLimit,
        numberOfRecipients: giftingActuals.uniqueRecipients,
        giftSplitting: giftingActuals.splitElected,
      }))
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [giftingActuals])

  // CST config state
  const [cstConfig, setCstConfig] = useState<Partial<CSTConfig>>({
    cstGrowthRate: 0.06,
    yearsBetweenDeaths: 5,
    lawScenario,
  })

  // Revocable trust config state
  const [rtConfig, setRtConfig] = useState<RevocableTrustConfig>({
    trustFundedAmount: grossEstate * 0.8,
    grossEstate,
    hasPourOverWill: false,
    isFunded: false,
    hasSuccessorTrustee: false,
  })

  const STRATEGIES = [
    { id: 'none' as StrategyType, label: 'Base Case' },
    { id: 'gifting' as StrategyType, label: 'Annual Gifting' },
    { id: 'revocable_trust' as StrategyType, label: 'Revocable Trust' },
    { id: 'credit_shelter_trust' as StrategyType, label: 'Credit Shelter Trust' },
  ]

  // Compute strategy result for display
  const giftingResult = selectedStrategy === 'gifting'
    ? applyGiftingProgram(EMPTY_PROJECTION_SCENARIO, giftingConfig, person1BirthYear + 80, lawScenario)
    : null

  const cstResult = selectedStrategy === 'credit_shelter_trust'
    ? applyCreditShelterTrust(EMPTY_PROJECTION_SCENARIO, {
        grossEstateAtFirstDeath: grossEstate,
        federalExemptionAtFirstDeath: federalExemption,
        cstGrowthRate: cstConfig.cstGrowthRate ?? 0.06,
        yearsBetweenDeaths: cstConfig.yearsBetweenDeaths ?? 5,
        federalExemptionAtSecondDeath: federalExemption,
        survivingSpouseAssets: grossEstate * 0.1,
        lawScenario,
      })
    : null

  const rtResult = selectedStrategy === 'revocable_trust'
    ? applyRevocableTrust(EMPTY_PROJECTION_SCENARIO, rtConfig)
    : null

  const showStateTaxColumn = !!statePrimary && STATE_ESTATE_TAX_STATES.has(statePrimary.toUpperCase())
  const sortedProjectionData = [...projectionData].sort((a, b) => a.year - b.year)
  const atDeathYear = sortedProjectionData.length > 0 ? sortedProjectionData[sortedProjectionData.length - 1].year : null
  const horizons = [
    ...BASE_HORIZON_YEARS,
    { label: 'At Death', yearsFromNow: atDeathYear != null ? Math.max(0, atDeathYear - CURRENT_YEAR) : 0 },
  ]

  function getEngineProjectionForYear(year: number) {
    const exact = sortedProjectionData.find((row) => row.year === year)
    if (exact) return exact
    return sortedProjectionData.reduce<{ year: number; gross_estate: number; federal_tax: number; state_tax: number } | null>(
      (closest, row) => {
        if (!closest) return row
        return Math.abs(row.year - year) < Math.abs(closest.year - year) ? row : closest
      },
      null,
    )
  }

  return (
    <div className="space-y-6">
      {/* Strategy Selector */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Select Strategy to Model</h3>
        <div className="flex flex-wrap gap-2">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStrategy(s.id)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                selectedStrategy === s.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gifting Config */}
      {selectedStrategy === 'gifting' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Gifting Program Parameters</h4>
          {giftingActuals && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-blue-800">Client actuals (this calendar year)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-blue-700">
                <span>Annual used</span>
                <span className="text-right font-medium">${giftingActuals.annualUsed.toLocaleString()} / ${giftingActuals.annualCapacity.toLocaleString()}</span>
                <span>Lifetime used</span>
                <span className="text-right font-medium">${giftingActuals.lifetimeUsed.toLocaleString()}</span>
                <span>Lifetime remaining</span>
                <span className="text-right font-medium">${Math.round(giftingActuals.lifetimeRemaining).toLocaleString()}</span>
                <span>Split elected</span>
                <span className="text-right font-medium">{giftingActuals.splitElected ? 'Yes' : 'No'}</span>
              </div>
              <p className="text-blue-500 pt-1">Parameters below are pre-filled from client data. Adjust to model future scenarios.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Annual Gift Per Donor</label>
              <input
                type="number"
                value={giftingConfig.annualGiftPerDonor}
                onChange={(e) => setGiftingConfig(c => ({ ...c, annualGiftPerDonor: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Number of Recipients</label>
              <input
                type="number"
                value={giftingConfig.numberOfRecipients}
                onChange={(e) => setGiftingConfig(c => ({ ...c, numberOfRecipients: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Year</label>
              <input
                type="number"
                value={giftingConfig.startYear}
                onChange={(e) => setGiftingConfig(c => ({ ...c, startYear: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="giftSplitting"
                checked={giftingConfig.giftSplitting}
                onChange={(e) => setGiftingConfig(c => ({ ...c, giftSplitting: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="giftSplitting" className="text-sm text-gray-600">Gift Splitting (both spouses)</label>
            </div>
          </div>

          {giftingResult && (
            <div className="mt-4 border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Gifts Out</span>
                <span className="font-medium">${giftingResult.totalGiftsOut.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Net Estate Reduction</span>
                <span className="font-medium text-green-700">${giftingResult.netEstateReduction.toLocaleString()}</span>
              </div>
              {giftingResult.section2035Flag && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 mt-2">
                  ⚠️ {giftingResult.section2035Warning}
                </div>
              )}
            </div>
          )}
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">Mark this strategy as recommended for client</span>
            <button
              type="button"
              onClick={() => toggleRecommended('gifting', 'Annual Gifting Program')}
              disabled={saving}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                savedStrategies.has('gifting')
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {savedStrategies.has('gifting') ? '✓ Recommended' : 'Mark as recommended'}
            </button>
          </div>
        </div>
      )}

      {/* CST Config */}
      {selectedStrategy === 'credit_shelter_trust' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Credit Shelter Trust Parameters</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">CST Growth Rate</label>
              <input
                type="number"
                step="0.01"
                value={cstConfig.cstGrowthRate}
                onChange={(e) => setCstConfig(c => ({ ...c, cstGrowthRate: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Years Between Deaths</label>
              <input
                type="number"
                value={cstConfig.yearsBetweenDeaths}
                onChange={(e) => setCstConfig(c => ({ ...c, yearsBetweenDeaths: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {cstResult && (
            <div className="mt-4 border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CST Funding Amount</span>
                <span className="font-medium">${cstResult.cstFundingAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CST Value at 2nd Death</span>
                <span className="font-medium">${Math.round(cstResult.cstValueAtSecondDeath).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax Savings vs Portability</span>
                <span className={`font-medium ${cstResult.cstBeatPortability ? 'text-green-700' : 'text-gray-500'}`}>
                  ${Math.round(cstResult.taxSavingsVsPortability).toLocaleString()}
                </span>
              </div>
              {cstResult.crossoverYear && (
                <div className="text-xs text-gray-500 mt-1">
                  CST assets projected to exceed survivor exemption around {cstResult.crossoverYear}
                </div>
              )}
              {cstResult.advisoryNotes.map((note, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-800 mt-2">
                  {note}
                </div>
              ))}
            </div>
          )}
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">Mark this strategy as recommended for client</span>
            <button
              type="button"
              onClick={() => toggleRecommended('credit_shelter_trust', 'Credit Shelter Trust (CST)')}
              disabled={saving}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                savedStrategies.has('credit_shelter_trust')
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {savedStrategies.has('credit_shelter_trust') ? '✓ Recommended' : 'Mark as recommended'}
            </button>
          </div>
        </div>
      )}

      {/* Revocable Trust */}
      {selectedStrategy === 'revocable_trust' && rtResult && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Revocable Trust Assessment</h4>
          <div className="space-y-2">
            {[
              { label: 'Trust Funded', value: rtConfig.isFunded, key: 'isFunded' as const },
              { label: 'Pour-Over Will', value: rtConfig.hasPourOverWill, key: 'hasPourOverWill' as const },
              { label: 'Successor Trustee Named', value: rtConfig.hasSuccessorTrustee, key: 'hasSuccessorTrustee' as const },
            ].map(({ label, value, key }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <button
                  onClick={() => setRtConfig(c => ({ ...c, [key]: !c[key] }))}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {value ? 'Yes' : 'No'}
                </button>
              </div>
            ))}
          </div>
          {rtResult.actionItems.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-red-700">Action Items:</p>
              {rtResult.actionItems.map((item, i) => (
                <div key={i} className="text-xs text-red-600 flex gap-1">
                  <span>•</span><span>{item}</span>
                </div>
              ))}
            </div>
          )}
          {rtResult.advisoryNotes.map((note, i) => (
            <div key={i} className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-800">
              {note}
            </div>
          ))}
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">Mark this strategy as recommended for client</span>
            <button
              type="button"
              onClick={() => toggleRecommended('revocable_trust', 'Revocable Living Trust')}
              disabled={saving}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                savedStrategies.has('revocable_trust')
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {savedStrategies.has('revocable_trust') ? '✓ Recommended' : 'Mark as recommended'}
            </button>
          </div>
        </div>
      )}

      {/* Net-to-Heirs Table — Today / +10 / +20 / At Death horizons */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Net to Heirs by Horizon</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Horizon</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Gross Estate</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Federal Estimated Tax</th>
                {showStateTaxColumn && (
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Est. State Tax</th>
                )}
                <th className="text-right py-2 px-3 font-medium text-gray-600">Net to Heirs</th>
                {selectedStrategy !== 'none' && (
                  <th className="text-right py-2 px-3 font-medium text-blue-600">With Strategy</th>
                )}
              </tr>
            </thead>
            <tbody>
              {horizons.map(({ label, yearsFromNow }) => {
                const targetYear = CURRENT_YEAR + yearsFromNow
                const engineProjection = getEngineProjectionForYear(targetYear)
                const projected = projectEstateBlended(
                  grossEstate,
                  yearsFromNow,
                  person1BirthYear,
                  person1RetirementAge,
                  growthRateAccumulation,
                  growthRateRetirement,
                )
                const baseGrossEstate = engineProjection?.gross_estate ?? projected
                const federalTaxBase = engineProjection?.federal_tax ?? (projected - calcNetToHeirs(projected, filingStatus, lawScenario))
                const stateTaxBase = engineProjection?.state_tax ?? 0
                const netBase = Math.max(0, baseGrossEstate - federalTaxBase - (showStateTaxColumn ? stateTaxBase : 0))

                // Strategy-adjusted net (gifting reduces gross estate)
                let netWithStrategy = netBase
                if (selectedStrategy === 'gifting' && giftingResult) {
                  const adjustedEstate = Math.max(0, projected - giftingResult.netEstateReduction)
                  netWithStrategy = calcNetToHeirs(adjustedEstate, filingStatus, lawScenario)
                } else if (selectedStrategy === 'credit_shelter_trust' && cstResult) {
                  netWithStrategy = cstResult.netToHeirsWithCST
                }

                return (
                  <tr key={label} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700">{label}</td>
                    <td className="py-2 px-3 text-right text-gray-700">${Math.round(baseGrossEstate).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-red-600">${Math.round(federalTaxBase).toLocaleString()}</td>
                    {showStateTaxColumn && (
                      <td className="py-2 px-3 text-right text-red-600">${Math.round(stateTaxBase).toLocaleString()}</td>
                    )}
                    <td className="py-2 px-3 text-right font-medium">${Math.round(netBase).toLocaleString()}</td>
                    {selectedStrategy !== 'none' && (
                      <td className="py-2 px-3 text-right font-medium text-blue-700">
                        ${Math.round(netWithStrategy).toLocaleString()}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Horizons use engine projection outputs when available (including federal/state tax); fallback is profile growth assumptions ({growthRateAccumulation}% accumulation before retirement, {growthRateRetirement}% after). Federal exemption reflects OBBBA 2026: $15M single / $30M MFJ under Current Law. No-Exemption scenario is a stress test only.
        </p>
      </div>
    </div>
  )
}
