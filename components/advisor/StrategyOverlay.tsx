'use client'

// Sprint 67 — Strategy Overlay UI
// Side-by-side comparison of base case vs strategy scenarios
// Renders in StrategyTab
// Net-to-heirs table at mortality ages 75, 80, 85, 90

import { useState } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { applyGiftingProgram, GiftingProgramConfig } from '@/lib/strategy/applyGiftingProgram'
import { applyCreditShelterTrust, CSTConfig } from '@/lib/strategy/applyCreditShelterTrust'
import { applyRevocableTrust, RevocableTrustConfig } from '@/lib/strategy/applyRevocableTrust'

type StrategyType = 'none' | 'gifting' | 'revocable_trust' | 'credit_shelter_trust'

interface StrategyOverlayProps {
  householdId: string
  grossEstate: number
  federalExemption: number
  person1BirthYear: number
  person2BirthYear?: number
  lawScenario: 'current_law' | 'sunset' | 'no_exemption'
}

const MORTALITY_AGES = [75, 80, 85, 90]
const ESTATE_TAX_RATE = 0.40
const CURRENT_YEAR = new Date().getFullYear()

function projectEstateAtAge(
  grossEstate: number,
  growthRate: number,
  birthYear: number,
  age: number
): number {
  const years = age - (CURRENT_YEAR - birthYear)
  if (years <= 0) return grossEstate
  return grossEstate * Math.pow(1 + growthRate, years)
}

function calcNetToHeirs(
  estate: number,
  exemption: number,
  lawScenario: 'current_law' | 'sunset' | 'no_exemption'
): number {
  if (lawScenario === 'no_exemption') return estate * (1 - ESTATE_TAX_RATE)
  const effectiveExemption = lawScenario === 'sunset' ? Math.min(exemption, 7_000_000) : exemption
  const taxable = Math.max(0, estate - effectiveExemption)
  return estate - taxable * ESTATE_TAX_RATE
}

export default function StrategyOverlay({
  householdId,
  grossEstate,
  federalExemption,
  person1BirthYear,
  person2BirthYear,
  lawScenario,
}: StrategyOverlayProps) {
  void householdId

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('none')
  const [growthRate] = useState(0.06)

  // Gifting config state
  const [giftingConfig, setGiftingConfig] = useState<GiftingProgramConfig>({
    annualGiftPerDonor: 18000,
    numberOfRecipients: 2,
    startYear: CURRENT_YEAR,
    giftSplitting: !!person2BirthYear,
  })

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
    ? applyGiftingProgram({} as any, giftingConfig, person1BirthYear + 80, lawScenario)
    : null

  const cstResult = selectedStrategy === 'credit_shelter_trust'
    ? applyCreditShelterTrust({} as any, {
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
    ? applyRevocableTrust({} as any, rtConfig)
    : null

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
        </div>
      )}

      {/* Net-to-Heirs Table — mortality ages 75, 80, 85, 90 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Net to Heirs at Mortality Ages</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Age at Death</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Gross Estate</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Est. Tax</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Net to Heirs</th>
                {selectedStrategy !== 'none' && (
                  <th className="text-right py-2 px-3 font-medium text-blue-600">With Strategy</th>
                )}
              </tr>
            </thead>
            <tbody>
              {MORTALITY_AGES.map((age) => {
                const projected = projectEstateAtAge(grossEstate, growthRate, person1BirthYear, age)
                const netBase = calcNetToHeirs(projected, federalExemption, lawScenario)
                const taxBase = projected - netBase

                // Strategy-adjusted net (gifting reduces gross estate)
                let netWithStrategy = netBase
                if (selectedStrategy === 'gifting' && giftingResult) {
                  const adjustedEstate = Math.max(0, projected - giftingResult.netEstateReduction)
                  netWithStrategy = calcNetToHeirs(adjustedEstate, federalExemption, lawScenario)
                } else if (selectedStrategy === 'credit_shelter_trust' && cstResult) {
                  netWithStrategy = cstResult.netToHeirsWithCST
                }

                return (
                  <tr key={age} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700">Age {age}</td>
                    <td className="py-2 px-3 text-right text-gray-700">${Math.round(projected / 1000)}K</td>
                    <td className="py-2 px-3 text-right text-red-600">${Math.round(taxBase / 1000)}K</td>
                    <td className="py-2 px-3 text-right font-medium">${Math.round(netBase / 1000)}K</td>
                    {selectedStrategy !== 'none' && (
                      <td className="py-2 px-3 text-right font-medium text-blue-700">
                        ${Math.round(netWithStrategy / 1000)}K
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Projected at {(growthRate * 100).toFixed(0)}% annual growth. All figures rounded to nearest $1K.
        </p>
      </div>

      <DisclaimerBanner />
    </div>
  )
}
