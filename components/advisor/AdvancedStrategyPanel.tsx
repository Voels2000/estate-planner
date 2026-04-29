'use client'

// Advisor advanced strategy modeling panel (GRAT/CRT/CLAT/DAF/Liquidity/Roth).
// Recommendation toggles persist advisor-owned strategy recommendations via
// canonical advisor endpoints.

import { useState, useEffect } from 'react'
import { applyGRAT, GRATConfig } from '@/lib/strategy/applyGRAT'
import { applyCRT, applyCLAT, applyDAF, DAFConfig } from '@/lib/strategy/applyCharitableStrategies'
import { analyzeLiquidity, LiquidityConfig } from '@/lib/strategy/analyzeLiquidity'
import { modelRothConversion, RothConversionConfig } from '@/lib/strategy/modelRothConversion'
import type { StrategyLineItemInput } from '@/lib/estate/types'

type AdvancedPanel = 'grat' | 'crt' | 'clat' | 'daf' | 'liquidity' | 'roth' | null

interface AdvancedStrategyPanelProps {
  householdId: string
  grossEstate: number
  federalExemption: number
  estimatedFederalTax: number
  estimatedStateTax: number
  person1BirthYear: number
  annualRMD?: number
  preIRABalance?: number
  rothBalance?: number
  onRecommend?: () => void | Promise<void>
}

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_7520_RATE = 0.052

function toAdvisorConfidence(
  confidence?: StrategyLineItemInput['confidence_level'],
): 'low' | 'medium' | 'high' {
  if (confidence === 'certain') return 'high'
  if (confidence === 'probable') return 'medium'
  return 'low'
}

async function writeAdvisorRecommendation(input: StrategyLineItemInput) {
  await fetch('/api/advisor/strategy-recommendation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      householdId: input.household_id,
      strategySource: input.strategy_source,
      amount: Math.abs(input.amount ?? 0),
      sign: input.sign ?? -1,
      confidenceLevel: toAdvisorConfidence(input.confidence_level),
      effectiveYear: input.effective_year ?? undefined,
      metadata: input.metadata ?? {},
    }),
  })
}

async function removeAdvisorRecommendation(householdId: string, strategySource: string) {
  await fetch('/api/advisor/strategy-recommendation', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ householdId, strategySource }),
  })
}

function useRecommendAdvanced(
  householdId: string,
  onRecommend?: () => void | Promise<void>,
) {
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!householdId) return
    fetch('/api/advisor/strategy-recommendations-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    })
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d?.items) ? d.items : []
        setSaved(new Set(items.map((s: { strategy_source: string }) => s.strategy_source)))
      })
      .catch(() => setSaved(new Set()))
  }, [householdId])

  async function toggle(
    strategySource: string,
    lineItemInput: Omit<StrategyLineItemInput, 'household_id'>,
    sourceRole: 'consumer' | 'advisor' = 'advisor',
  ) {
    setSaving(true)
    const isActive = saved.has(strategySource)
    if (isActive) {
      await removeAdvisorRecommendation(householdId, strategySource)
    } else {
      await writeAdvisorRecommendation({ ...lineItemInput, household_id: householdId, source_role: sourceRole })
    }
    setSaved(prev => {
      const next = new Set(prev)
      if (isActive) next.delete(strategySource)
      else next.add(strategySource)
      return next
    })
    setSaving(false)
    await onRecommend?.()
  }

  return { saved, saving, toggle }
}

function RecommendButton({
  strategySource,
  saved,
  saving,
  onToggle,
}: {
  strategySource: string
  saved: Set<string>
  saving: boolean
  onToggle: () => void
}) {
  const isRecommended = saved.has(strategySource)
  return (
    <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
      <span className="text-xs text-gray-500">Mark this strategy as recommended for client</span>
      <button
        type="button"
        onClick={() => {
          onToggle()
        }}
        disabled={saving}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          isRecommended
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
        }`}
      >
        {isRecommended ? '✓ Recommended' : 'Mark as recommended'}
      </button>
    </div>
  )
}

export default function AdvancedStrategyPanel({
  householdId,
  grossEstate,
  federalExemption: _federalExemption,
  estimatedFederalTax,
  estimatedStateTax,
  person1BirthYear,
  annualRMD = 0,
  preIRABalance = 0,
  rothBalance = 0,
  onRecommend,
}: AdvancedStrategyPanelProps) {
  void _federalExemption
  const { saved, saving, toggle } = useRecommendAdvanced(householdId, onRecommend)
  const [activePanel, setActivePanel] = useState<AdvancedPanel>(null)
  const defaultDeathYear = person1BirthYear + 82

  const [gratConfig, setGratConfig] = useState<GRATConfig>({
    fundingAmount: Math.min(5_000_000, grossEstate * 0.25),
    termYears: 5,
    expectedGrowthRate: 0.08,
    section7520Rate: DEFAULT_7520_RATE,
    isZeroedOut: true,
    isRollingStrategy: false,
    numberOfRollingGRATs: 5,
    grantorAge: CURRENT_YEAR - person1BirthYear,
    deathYear: defaultDeathYear,
    establishmentYear: CURRENT_YEAR,
  })

  const [crtConfig, setCrtConfig] = useState({
    fundingAmount: 1_000_000,
    payoutRate: 0.05,
    termYears: 20,
    section7520Rate: DEFAULT_7520_RATE,
    marginalIncomeTaxRate: 0.37,
    growthRate: 0.06,
  })

  const [clatConfig, setClatConfig] = useState({
    fundingAmount: 2_000_000,
    annualCharitableAnnuity: 200_000,
    termYears: 10,
    section7520Rate: DEFAULT_7520_RATE,
    growthRate: 0.08,
    isZeroedOut: true,
  })

  const [dafConfig, setDafConfig] = useState<DAFConfig>({
    contributionAmount: 500_000,
    assetType: 'appreciated_securities',
    costBasis: 100_000,
    marginalIncomeTaxRate: 0.37,
    capitalGainsRate: 0.238,
  })

  const [liquidityConfig, setLiquidityConfig] = useState<LiquidityConfig>({
    liquidAssets: grossEstate * 0.3,
    illiquidAssets: grossEstate * 0.7,
    estimatedFederalTax,
    estimatedStateTax,
    ilitDeathBenefit: 0,
    ilitSection2035Flag: false,
    otherLiquiditySources: 0,
  })

  const [rothConfig, setRothConfig] = useState<RothConversionConfig>({
    preIRABalance,
    annualRMD,
    annualConversionAmount: 100_000,
    conversionYears: 10,
    marginalTaxRateDuringConversion: 0.32,
    beneficiaryMarginalTaxRate: 0.37,
    growthRate: 0.07,
    discountRate: 0.05,
    yearsUntilDeath: defaultDeathYear - CURRENT_YEAR,
  })

  const PANELS = [
    { id: 'grat' as AdvancedPanel, label: 'GRAT' },
    { id: 'crt' as AdvancedPanel, label: 'CRT' },
    { id: 'clat' as AdvancedPanel, label: 'CLAT' },
    { id: 'daf' as AdvancedPanel, label: 'DAF' },
    { id: 'liquidity' as AdvancedPanel, label: 'Liquidity' },
    { id: 'roth' as AdvancedPanel, label: 'Roth Conversion' },
  ]

  const gratResult = activePanel === 'grat' ? applyGRAT(gratConfig) : null
  const crtResult = activePanel === 'crt' ? applyCRT(crtConfig) : null
  const clatResult = activePanel === 'clat' ? applyCLAT(clatConfig) : null
  const dafResult = activePanel === 'daf' ? applyDAF(dafConfig) : null
  const liquidityResult = activePanel === 'liquidity'
    ? analyzeLiquidity({ ...liquidityConfig, estimatedFederalTax, estimatedStateTax })
    : null
  const rothResult = activePanel === 'roth' ? modelRothConversion(rothConfig) : null

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Advanced Strategies</h3>
        <div className="flex flex-wrap gap-2">
          {PANELS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePanel(activePanel === p.id ? null : p.id)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                activePanel === p.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {p.label}
              {saved.has(p.id ?? '') && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRAT Panel ── */}
      {activePanel === 'grat' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Grantor Retained Annuity Trust (GRAT)</h4>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Funding Amount', key: 'fundingAmount', value: gratConfig.fundingAmount },
              { label: 'Term (years)', key: 'termYears', value: gratConfig.termYears },
              { label: 'Expected Growth Rate', key: 'expectedGrowthRate', value: gratConfig.expectedGrowthRate, step: 0.01 },
              { label: '§7520 Rate', key: 'section7520Rate', value: gratConfig.section7520Rate, step: 0.001 },
              { label: 'Death Year', key: 'deathYear', value: gratConfig.deathYear },
              { label: 'Rolling GRATs #', key: 'numberOfRollingGRATs', value: gratConfig.numberOfRollingGRATs },
            ].map(({ label, key, value, step }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" step={step ?? 1} value={value}
                  onChange={(e) => setGratConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isZeroedOut" checked={gratConfig.isZeroedOut}
                onChange={(e) => setGratConfig(c => ({ ...c, isZeroedOut: e.target.checked }))} className="rounded" />
              <label htmlFor="isZeroedOut" className="text-sm text-gray-600">Zeroed-out GRAT</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isRolling" checked={gratConfig.isRollingStrategy}
                onChange={(e) => setGratConfig(c => ({ ...c, isRollingStrategy: e.target.checked }))} className="rounded" />
              <label htmlFor="isRolling" className="text-sm text-gray-600">Rolling GRAT strategy</label>
            </div>
          </div>
          {gratResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Annual Annuity</span><span className="font-medium">{fmt(gratResult.annualAnnuityPayment)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Taxable Gift</span><span className="font-medium">{fmt(gratResult.taxableGift)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Projected Remainder</span><span className="font-medium text-green-700">{fmt(gratResult.projectedRemainder)}</span></div>
              {gratResult.rollingStrategyTotalRemainder !== undefined && (
                <div className="flex justify-between text-sm"><span className="text-gray-600">Rolling Strategy Remainder</span><span className="font-medium text-blue-700">{fmt(gratResult.rollingStrategyTotalRemainder)}</span></div>
              )}
              {gratResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton strategySource="grat" saved={saved} saving={saving}
            onToggle={() => toggle('grat', {
              scenario_id: 'current_law',
              // GRAT assets remain in gross estate during the term.
              // Only the remainder passes outside — and only if grantor survives the term.
              // Shown as illustrative / future projection, not a current reduction.
              metric_target: 'gross_estate',
              category: 'trust_exclusion',
              strategy_source: 'grat',
              amount: gratResult?.projectedRemainder ?? 0,
              sign: -1,
              confidence_level: 'illustrative',
              effective_year: new Date().getFullYear() + (gratConfig.termYears ?? 5),
              metadata: {
                funding_amount: gratConfig.fundingAmount,
                term_years: gratConfig.termYears,
                projected_remainder: gratResult?.projectedRemainder ?? 0,
                note: 'Remainder passes to beneficiaries after GRAT term if grantor survives. Assets remain in gross estate during term.',
                condition: 'grantor_survives_term',
              },
            }, 'advisor')} />
        </div>
      )}

      {/* ── CRT Panel ── */}
      {activePanel === 'crt' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Charitable Remainder Trust (CRT)</h4>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Funding Amount', key: 'fundingAmount', value: crtConfig.fundingAmount },
              { label: 'Payout Rate', key: 'payoutRate', value: crtConfig.payoutRate, step: 0.01 },
              { label: 'Term (years)', key: 'termYears', value: crtConfig.termYears },
              { label: '§7520 Rate', key: 'section7520Rate', value: crtConfig.section7520Rate, step: 0.001 },
              { label: 'Marginal Tax Rate', key: 'marginalIncomeTaxRate', value: crtConfig.marginalIncomeTaxRate, step: 0.01 },
              { label: 'Growth Rate', key: 'growthRate', value: crtConfig.growthRate, step: 0.01 },
            ].map(({ label, key, value, step }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" step={step ?? 1} value={value}
                  onChange={(e) => setCrtConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
          </div>
          {crtResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Annual Income</span><span className="font-medium">{fmt(crtResult.annualIncome)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Charitable Deduction</span><span className="font-medium">{fmt(crtResult.charitableDeduction)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Tax Savings</span><span className="font-medium text-green-700">{fmt(crtResult.taxSavingsFromDeduction)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Estate Reduction</span><span className="font-medium text-green-700">{fmt(crtResult.estateReduction)}</span></div>
              {crtResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton strategySource="crt" saved={saved} saving={saving}
            onToggle={() => toggle('crt', {
              scenario_id: 'current_law',
              metric_target: 'taxable_estate',
              category: 'charitable',
              strategy_source: 'crt',
              amount: crtResult?.estateReduction ?? crtConfig.fundingAmount,
              sign: -1,
              confidence_level: 'illustrative',
              metadata: { funding_amount: crtConfig.fundingAmount, payout_rate: crtConfig.payoutRate },
            }, 'advisor')} />
        </div>
      )}

      {/* ── CLAT Panel ── */}
      {activePanel === 'clat' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Charitable Lead Annuity Trust (CLAT)</h4>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Funding Amount', key: 'fundingAmount', value: clatConfig.fundingAmount },
              { label: 'Annual Charitable Annuity', key: 'annualCharitableAnnuity', value: clatConfig.annualCharitableAnnuity },
              { label: 'Term (years)', key: 'termYears', value: clatConfig.termYears },
              { label: '§7520 Rate', key: 'section7520Rate', value: clatConfig.section7520Rate, step: 0.001 },
              { label: 'Growth Rate', key: 'growthRate', value: clatConfig.growthRate, step: 0.01 },
            ].map(({ label, key, value, step }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" step={step ?? 1} value={value}
                  onChange={(e) => setClatConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="clatZeroed" checked={clatConfig.isZeroedOut}
                onChange={(e) => setClatConfig(c => ({ ...c, isZeroedOut: e.target.checked }))} className="rounded" />
              <label htmlFor="clatZeroed" className="text-sm text-gray-600">Zeroed-out CLAT</label>
            </div>
          </div>
          {clatResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Taxable Gift</span><span className="font-medium">{fmt(clatResult.taxableGift)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Projected Remainder to Heirs</span><span className="font-medium text-green-700">{fmt(clatResult.projectedRemainder)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Charitable Giving</span><span className="font-medium">{fmt(clatResult.totalCharitableGiving)}</span></div>
              {clatResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton strategySource="clat" saved={saved} saving={saving}
            onToggle={() => toggle('clat', {
              scenario_id: 'current_law',
              metric_target: 'taxable_estate',
              category: 'charitable',
              strategy_source: 'clat',
              amount: clatResult?.projectedRemainder ?? clatConfig.fundingAmount,
              sign: -1,
              confidence_level: 'illustrative',
              metadata: { funding_amount: clatConfig.fundingAmount, term_years: clatConfig.termYears },
            }, 'advisor')} />
        </div>
      )}

      {/* ── DAF Panel ── */}
      {activePanel === 'daf' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Donor Advised Fund (DAF)</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Contribution Amount</label>
              <input type="number" value={dafConfig.contributionAmount}
                onChange={(e) => setDafConfig(c => ({ ...c, contributionAmount: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Asset Type</label>
              <select value={dafConfig.assetType}
                onChange={(e) => setDafConfig(c => ({ ...c, assetType: e.target.value as DAFConfig['assetType'] }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm">
                <option value="cash">Cash</option>
                <option value="appreciated_securities">Appreciated Securities</option>
                <option value="real_estate">Real Estate</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cost Basis</label>
              <input type="number" value={dafConfig.costBasis}
                onChange={(e) => setDafConfig(c => ({ ...c, costBasis: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Capital Gains Rate</label>
              <input type="number" step="0.01" value={dafConfig.capitalGainsRate}
                onChange={(e) => setDafConfig(c => ({ ...c, capitalGainsRate: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
            </div>
          </div>
          {dafResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Charitable Deduction</span><span className="font-medium">{fmt(dafResult.charitableDeduction)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Income Tax Savings</span><span className="font-medium text-green-700">{fmt(dafResult.taxSavingsFromDeduction)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Capital Gains Avoided</span><span className="font-medium text-green-700">{fmt(dafResult.capitalGainsTaxAvoided)}</span></div>
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2"><span className="text-gray-700">Total Benefit</span><span className="text-green-700">{fmt(dafResult.totalBenefit)}</span></div>
              {dafResult.advisoryNotes.map((note, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-800 mt-2">{note}</div>
              ))}
            </div>
          )}
          <RecommendButton strategySource="daf" saved={saved} saving={saving}
            onToggle={() => toggle('daf', {
              scenario_id: 'current_law',
              metric_target: 'taxable_estate',
              category: 'charitable',
              strategy_source: 'daf',
              amount: dafConfig.contributionAmount,
              sign: -1,
              confidence_level: 'probable',
              metadata: { contribution_amount: dafConfig.contributionAmount, asset_type: dafConfig.assetType },
            }, 'advisor')} />
        </div>
      )}

      {/* ── Liquidity Panel ── */}
      {activePanel === 'liquidity' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Estate Liquidity Analysis</h4>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Liquid Assets', key: 'liquidAssets', value: liquidityConfig.liquidAssets },
              { label: 'Illiquid Assets', key: 'illiquidAssets', value: liquidityConfig.illiquidAssets },
              { label: 'Est. Federal Tax', key: 'estimatedFederalTax', value: liquidityConfig.estimatedFederalTax },
              { label: 'Est. State Tax', key: 'estimatedStateTax', value: liquidityConfig.estimatedStateTax },
              { label: 'ILIT Death Benefit', key: 'ilitDeathBenefit', value: liquidityConfig.ilitDeathBenefit },
              { label: 'Other Liquidity Sources', key: 'otherLiquiditySources', value: liquidityConfig.otherLiquiditySources },
            ].map(({ label, key, value }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" value={value}
                  onChange={(e) => setLiquidityConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
            <div className="flex items-center gap-2 col-span-2">
              <input type="checkbox" id="ilit2035" checked={liquidityConfig.ilitSection2035Flag}
                onChange={(e) => setLiquidityConfig(c => ({ ...c, ilitSection2035Flag: e.target.checked }))} className="rounded" />
              <label htmlFor="ilit2035" className="text-sm text-gray-600">ILIT §2035 flag active</label>
            </div>
          </div>
          {liquidityResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Tax Burden</span><span className="font-medium text-red-600">{fmt(liquidityResult.totalTaxBurden)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Liquidity</span><span className="font-medium">{fmt(liquidityResult.totalLiquidity)}</span></div>
              {liquidityResult.totalTaxBurden === 0 ? (
                <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-800">
                  No estate tax projected. Switch to No Exemption stress scenario in the Tax tab to model liquidity under a taxable estate.
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Coverage Ratio</span>
                  <span className={`font-medium ${liquidityResult.coverageRatio >= 1 ? 'text-green-700' : 'text-red-600'}`}>
                    {liquidityResult.coverageRatio.toFixed(2)}x
                  </span>
                </div>
              )}
              {liquidityResult.hasLiquidityShortfall && (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-red-600">Shortfall</span>
                  <span className="text-red-600">{fmt(Math.abs(liquidityResult.shortfall))}</span>
                </div>
              )}
              {liquidityResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton strategySource="liquidity" saved={saved} saving={saving}
            onToggle={() => toggle('liquidity', {
              scenario_id: 'current_law',
              metric_target: 'gross_estate',
              category: 'other' as never,
              strategy_source: 'other',
              amount: liquidityConfig.ilitDeathBenefit,
              sign: -1,
              confidence_level: 'illustrative',
              metadata: { liquid_assets: liquidityConfig.liquidAssets, illiquid_assets: liquidityConfig.illiquidAssets },
            }, 'advisor')} />
        </div>
      )}

      {/* ── Roth Panel ── */}
      {activePanel === 'roth' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Roth Conversion Analysis</h4>
          {rothBalance > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-blue-800">Client actuals (from base case)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-blue-700">
                <span>Current Roth balance</span><span className="text-right font-medium">${Math.round(rothBalance).toLocaleString()}</span>
                <span>Pre-tax IRA balance</span><span className="text-right font-medium">${Math.round(preIRABalance).toLocaleString()}</span>
                <span>Annual RMD</span><span className="text-right font-medium">${Math.round(annualRMD).toLocaleString()}</span>
              </div>
              <p className="text-blue-500 pt-1">Parameters below are pre-filled from client data.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Pre-Tax IRA Balance', key: 'preIRABalance', value: rothConfig.preIRABalance },
              { label: 'Annual RMD', key: 'annualRMD', value: rothConfig.annualRMD },
              { label: 'Annual Conversion Amount', key: 'annualConversionAmount', value: rothConfig.annualConversionAmount },
              { label: 'Conversion Years', key: 'conversionYears', value: rothConfig.conversionYears },
              { label: 'Marginal Rate (conversion)', key: 'marginalTaxRateDuringConversion', value: rothConfig.marginalTaxRateDuringConversion, step: 0.01 },
              { label: 'Beneficiary Marginal Rate', key: 'beneficiaryMarginalTaxRate', value: rothConfig.beneficiaryMarginalTaxRate, step: 0.01 },
              { label: 'Growth Rate', key: 'growthRate', value: rothConfig.growthRate, step: 0.01 },
              { label: 'Years Until Death', key: 'yearsUntilDeath', value: rothConfig.yearsUntilDeath },
            ].map(({ label, key, value, step }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" step={step ?? 1} value={value}
                  onChange={(e) => setRothConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
          </div>
          {rothResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Conversion Tax Cost</span><span className="font-medium text-red-600">${Math.round(rothResult.totalConversionTaxCost).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Projected Roth at Death</span><span className="font-medium">${Math.round(rothResult.projectedRothBalanceAtDeath).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Estate Reduction from Tax Payment</span><span className="font-medium text-green-700">${Math.round(rothResult.estateReductionFromTaxPayment).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
                <span className={rothResult.conversionIsNPVPositive ? 'text-green-700' : 'text-gray-700'}>NPV Benefit to Beneficiaries</span>
                <span className={rothResult.conversionIsNPVPositive ? 'text-green-700' : 'text-red-600'}>${Math.round(rothResult.npvBenefitToBeneficiaries).toLocaleString()}</span>
              </div>
              {rothResult.advisoryNotes?.map((note: string, i: number) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton strategySource="roth" saved={saved} saving={saving}
            onToggle={() => toggle('roth', {
              scenario_id: 'current_law',
              metric_target: 'taxable_estate',
              category: 'trust_exclusion',
              strategy_source: 'other',
              amount: rothResult?.estateReductionFromTaxPayment ?? rothConfig.annualConversionAmount * rothConfig.conversionYears,
              sign: -1,
              confidence_level: 'illustrative',
              metadata: { annual_conversion: rothConfig.annualConversionAmount, years: rothConfig.conversionYears },
            }, 'advisor')} />
        </div>
      )}
    </div>
  )
}
