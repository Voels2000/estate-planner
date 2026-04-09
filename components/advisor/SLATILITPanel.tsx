'use client'

import { useMemo, useState } from 'react'
import { applySLAT, SLATConfig } from '@/lib/strategy/applySLAT'
import { applyILIT, ILITConfig } from '@/lib/strategy/applyILIT'
import { applyIncomeTaxDrag } from '@/lib/strategy/applyGSTandIncomeTaxDrag'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { createClient } from '@/lib/supabase/client'

interface SLATILITPanelProps {
  householdId: string
  grossEstate: number
  federalExemption: number
  person1BirthYear: number
  person2BirthYear?: number
}

const CURRENT_YEAR = new Date().getFullYear()

export default function SLATILITPanel({
  householdId,
  grossEstate,
  federalExemption,
  person1BirthYear,
  person2BirthYear,
}: SLATILITPanelProps) {
  const defaultDeathYear = person1BirthYear + 82
  const supabase = useMemo(() => createClient(), [])

  const [slatConfig, setSlatConfig] = useState<SLATConfig>({
    fundingAmount: Math.min(federalExemption / 2, grossEstate * 0.3),
    establishmentYear: CURRENT_YEAR,
    growthRate: 0.06,
    isGrantorTrust: true,
    estimatedAnnualIncome: Math.min(federalExemption / 2, grossEstate * 0.3) * 0.03,
    grantorMarginalRate: 0.37,
    hasReciprocalSLAT: !!person2BirthYear,
    deathYear: defaultDeathYear,
    federalExemptionAtEstablishment: federalExemption,
  })

  const [ilitConfig, setIlitConfig] = useState<ILITConfig>({
    annualPremium: 50000,
    deathBenefit: 5000000,
    policyTermYears: 20,
    establishmentYear: CURRENT_YEAR,
    deathYear: defaultDeathYear,
    crummeyBeneficiaries: 2,
    isPolicyTransfer: false,
  })

  const [activePanel, setActivePanel] = useState<'slat' | 'ilit' | null>(null)
  const [isSavingLedger, setIsSavingLedger] = useState(false)
  const [ledgerMessage, setLedgerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const slatResult = activePanel === 'slat' ? applySLAT({} as any, slatConfig) : null
  const ilitResult = activePanel === 'ilit' ? applyILIT(ilitConfig) : null

  const incomeDragResult = activePanel === 'slat' && slatResult
    ? applyIncomeTaxDrag({
        annualTrustIncome: slatConfig.estimatedAnnualIncome,
        isGrantorTrust: slatConfig.isGrantorTrust,
        grantorMarginalRate: slatConfig.grantorMarginalRate,
        projectionYears: Math.max(0, slatConfig.deathYear - slatConfig.establishmentYear),
      })
    : null

  async function handleSaveToGSTLedger() {
    try {
      setIsSavingLedger(true)
      setLedgerMessage(null)

      const { error } = await supabase.from('gst_ledger').insert({
        household_id: householdId,
        transfer_year: CURRENT_YEAR,
        transfer_amount: slatConfig.fundingAmount,
        gst_exemption_allocated: Math.min(slatConfig.fundingAmount, federalExemption),
        is_skip_person: false,
        beneficiary_label: 'SLAT — Spouse',
        notes: 'Created via Strategy tab Sprint 68',
      })

      if (error) {
        setLedgerMessage({ type: 'error', text: error.message || 'Unable to save to GST ledger.' })
        return
      }

      setLedgerMessage({ type: 'success', text: 'Saved to GST ledger.' })
    } catch (error) {
      setLedgerMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unexpected error saving GST ledger entry.',
      })
    } finally {
      setIsSavingLedger(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex gap-2">
          {(['slat', 'ilit'] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => {
                setActivePanel(activePanel === panel ? null : panel)
                setLedgerMessage(null)
              }}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                activePanel === panel
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {panel === 'slat' ? 'SLAT' : 'ILIT'}
            </button>
          ))}
        </div>
      </div>

      {activePanel === 'slat' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Spousal Lifetime Access Trust (SLAT)</h4>

          {slatConfig.hasReciprocalSLAT && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-800 mb-1">Dual SLAT — Reciprocal Trust Doctrine Risk</p>
              <p className="text-xs text-red-700">
                Both spouses creating mirror-image SLATs risks IRS uncrossing them. Ensure SLATs differ
                in funding amount, trustee, distribution standard, or establishment date.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Funding Amount</label>
              <input
                type="number"
                value={slatConfig.fundingAmount}
                onChange={(e) => setSlatConfig((c) => ({ ...c, fundingAmount: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Growth Rate</label>
              <input
                type="number"
                step="0.01"
                value={slatConfig.growthRate}
                onChange={(e) => setSlatConfig((c) => ({ ...c, growthRate: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Establishment Year</label>
              <input
                type="number"
                value={slatConfig.establishmentYear}
                onChange={(e) => setSlatConfig((c) => ({ ...c, establishmentYear: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Est. Annual Income</label>
              <input
                type="number"
                value={slatConfig.estimatedAnnualIncome}
                onChange={(e) => setSlatConfig((c) => ({ ...c, estimatedAnnualIncome: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Death Year</label>
              <input
                type="number"
                value={slatConfig.deathYear}
                onChange={(e) => setSlatConfig((c) => ({ ...c, deathYear: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                id="isGrantorTrust"
                checked={slatConfig.isGrantorTrust}
                onChange={(e) => setSlatConfig((c) => ({ ...c, isGrantorTrust: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="isGrantorTrust" className="text-sm text-gray-600">
                Grantor Trust (grantor pays income tax)
              </label>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input
                type="checkbox"
                id="hasReciprocalSLAT"
                checked={slatConfig.hasReciprocalSLAT}
                onChange={(e) => setSlatConfig((c) => ({ ...c, hasReciprocalSLAT: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="hasReciprocalSLAT" className="text-sm text-gray-600">
                Second spouse also has SLAT (reciprocal trust risk)
              </label>
            </div>
          </div>

          {slatResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Estate Reduction at Funding</span>
                <span className="font-medium">${slatResult.estateReductionAtFunding.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">SLAT Value at Death</span>
                <span className="font-medium">${Math.round(slatResult.slatValueAtDeath).toLocaleString()}</span>
              </div>
              {slatConfig.isGrantorTrust && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Grantor Drag Benefit</span>
                  <span className="font-medium text-green-700">${Math.round(slatResult.totalGrantorDrag).toLocaleString()}</span>
                </div>
              )}
              {incomeDragResult && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Income Tax Paid by {incomeDragResult.taxPaidBy}</span>
                  <span className="font-medium">${Math.round(incomeDragResult.totalTaxOverPeriod).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
                <span className="text-gray-700">Net Estate Reduction</span>
                <span className="text-green-700">${Math.round(slatResult.netEstateReduction).toLocaleString()}</span>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveToGSTLedger}
                  disabled={isSavingLedger}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {isSavingLedger ? 'Saving…' : 'Save to GST Ledger'}
                </button>
                {ledgerMessage && (
                  <p
                    className={`mt-2 text-xs ${
                      ledgerMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {ledgerMessage.text}
                  </p>
                )}
              </div>

              {slatResult.advisoryNotes.map((note, i) => (
                <div
                  key={i}
                  className={`rounded p-3 text-xs mt-2 ${
                    note.startsWith('⚠️')
                      ? 'bg-amber-50 border border-amber-200 text-amber-800'
                      : 'bg-blue-50 border border-blue-100 text-blue-800'
                  }`}
                >
                  {note}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activePanel === 'ilit' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Irrevocable Life Insurance Trust (ILIT)</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Annual Premium</label>
              <input
                type="number"
                value={ilitConfig.annualPremium}
                onChange={(e) => setIlitConfig((c) => ({ ...c, annualPremium: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Death Benefit</label>
              <input
                type="number"
                value={ilitConfig.deathBenefit}
                onChange={(e) => setIlitConfig((c) => ({ ...c, deathBenefit: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Policy Term (years, 0=permanent)</label>
              <input
                type="number"
                value={ilitConfig.policyTermYears}
                onChange={(e) => setIlitConfig((c) => ({ ...c, policyTermYears: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Crummey Beneficiaries</label>
              <input
                type="number"
                value={ilitConfig.crummeyBeneficiaries}
                onChange={(e) => setIlitConfig((c) => ({ ...c, crummeyBeneficiaries: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Establishment Year</label>
              <input
                type="number"
                value={ilitConfig.establishmentYear}
                onChange={(e) => setIlitConfig((c) => ({ ...c, establishmentYear: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Death Year</label>
              <input
                type="number"
                value={ilitConfig.deathYear}
                onChange={(e) => setIlitConfig((c) => ({ ...c, deathYear: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="isPolicyTransfer"
                checked={ilitConfig.isPolicyTransfer}
                onChange={(e) => setIlitConfig((c) => ({ ...c, isPolicyTransfer: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="isPolicyTransfer" className="text-sm text-gray-600">
                Policy transferred (not new purchase)
              </label>
            </div>
          </div>

          {ilitResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Death Benefit</span>
                <span className="font-medium">
                  $
                  {ilitResult.section2035Flag
                    ? 'Included in estate (§2035)'
                    : ilitConfig.deathBenefit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Estate Tax Saved</span>
                <span className={`font-medium ${ilitResult.estateTaxSaved > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  ${Math.round(ilitResult.estateTaxSaved).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Policy IRR</span>
                <span className="font-medium">{(ilitResult.irrPct * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Premiums Paid</span>
                <span className="font-medium">${Math.round(ilitResult.totalPremiumsPaid).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Crummey per Beneficiary</span>
                <span className={`font-medium ${ilitResult.premiumsWithinExclusion ? 'text-green-700' : 'text-amber-600'}`}>
                  ${Math.round(ilitResult.crummeyAmountPerBeneficiary).toLocaleString()}
                  {ilitResult.premiumsWithinExclusion ? ' ✓ within exclusion' : ' ⚠ exceeds exclusion'}
                </span>
              </div>
              {ilitResult.advisoryNotes.map((note, i) => (
                <div
                  key={i}
                  className={`rounded p-3 text-xs mt-2 ${
                    note.startsWith('⚠️')
                      ? 'bg-amber-50 border border-amber-200 text-amber-800'
                      : 'bg-blue-50 border border-blue-100 text-blue-800'
                  }`}
                >
                  {note}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <DisclaimerBanner />
    </div>
  )
}
