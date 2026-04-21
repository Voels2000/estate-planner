'use client'

// Sprint 69 — AdvancedStrategyPanel
// Adds GRAT, CRT/CLAT/DAF, Liquidity Analysis, and Roth Conversion panels to StrategyTab
// Rendered below SLATILITPanel in StrategyTab

import { useState } from 'react'
import { applyGRAT, GRATConfig } from '@/lib/strategy/applyGRAT'
import { applyCRT, applyCLAT, applyDAF, DAFConfig } from '@/lib/strategy/applyCharitableStrategies'
import { analyzeLiquidity, LiquidityConfig } from '@/lib/strategy/analyzeLiquidity'
import { modelRothConversion, RothConversionConfig } from '@/lib/strategy/modelRothConversion'

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
}

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_7520_RATE = 0.052 // Update each month from IRS

export default function AdvancedStrategyPanel({
  householdId,
  grossEstate,
  federalExemption,
  estimatedFederalTax,
  estimatedStateTax,
  person1BirthYear,
  annualRMD = 0,
  preIRABalance = 0,
  rothBalance = 0,
}: AdvancedStrategyPanelProps) {
  void householdId
  void federalExemption

  const [activePanel, setActivePanel] = useState<AdvancedPanel>(null)
  const defaultDeathYear = person1BirthYear + 82

  // GRAT config
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

  // CRT config
  const [crtConfig, setCrtConfig] = useState({
    fundingAmount: 1_000_000,
    payoutRate: 0.05,
    termYears: 20,
    section7520Rate: DEFAULT_7520_RATE,
    marginalIncomeTaxRate: 0.37,
    growthRate: 0.06,
  })

  // CLAT config
  const [clatConfig, setClatConfig] = useState({
    fundingAmount: 2_000_000,
    annualCharitableAnnuity: 200_000,
    termYears: 10,
    section7520Rate: DEFAULT_7520_RATE,
    growthRate: 0.08,
    isZeroedOut: true,
  })

  // DAF config
  const [dafConfig, setDafConfig] = useState<DAFConfig>({
    contributionAmount: 500_000,
    assetType: 'appreciated_securities',
    costBasis: 100_000,
    marginalIncomeTaxRate: 0.37,
    capitalGainsRate: 0.238,
  })

  // Liquidity config
  const [liquidityConfig, setLiquidityConfig] = useState<LiquidityConfig>({
    liquidAssets: grossEstate * 0.3,
    illiquidAssets: grossEstate * 0.7,
    estimatedFederalTax,
    estimatedStateTax,
    ilitDeathBenefit: 0,
    ilitSection2035Flag: false,
    otherLiquiditySources: 0,
  })

  // Roth config
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
    ? analyzeLiquidity({
        ...liquidityConfig,
        estimatedFederalTax,
        estimatedStateTax,
      })
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
            </button>
          ))}
        </div>
      </div>

      {/* GRAT Panel */}
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
                <input
                  type="number"
                  step={step ?? 1}
                  value={value}
                  onChange={(e) => setGratConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isZeroedOut"
                checked={gratConfig.isZeroedOut}
                onChange={(e) => setGratConfig((c) => ({ ...c, isZeroedOut: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="isZeroedOut" className="text-sm text-gray-600">Zeroed-out GRAT</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRolling"
                checked={gratConfig.isRollingStrategy}
                onChange={(e) => setGratConfig((c) => ({ ...c, isRollingStrategy: e.target.checked }))}
                className="rounded"
              />
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
        </div>
      )}

      {/* CRT Panel */}
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
                <input
                  type="number"
                  step={step ?? 1}
                  value={value}
                  onChange={(e) => setCrtConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
                />
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
        </div>
      )}

      {/* CLAT Panel */}
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
                <input
                  type="number"
                  step={step ?? 1}
                  value={value}
                  onChange={(e) => setClatConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
                />
              </div>
            ))}
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="clatZeroed"
                checked={clatConfig.isZeroedOut}
                onChange={(e) => setClatConfig((c) => ({ ...c, isZeroedOut: e.target.checked }))}
                className="rounded"
              />
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
        </div>
      )}

      {/* DAF Panel */}
      {activePanel === 'daf' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Donor Advised Fund (DAF)</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Contribution Amount</label>
              <input
                type="number"
                value={dafConfig.contributionAmount}
                onChange={(e) => setDafConfig((c) => ({ ...c, contributionAmount: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Asset Type</label>
              <select
                value={dafConfig.assetType}
                onChange={(e) => setDafConfig((c) => ({ ...c, assetType: e.target.value as DAFConfig['assetType'] }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="appreciated_securities">Appreciated Securities</option>
                <option value="real_estate">Real Estate</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cost Basis</label>
              <input
                type="number"
                value={dafConfig.costBasis}
                onChange={(e) => setDafConfig((c) => ({ ...c, costBasis: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Capital Gains Rate</label>
              <input
                type="number"
                step="0.01"
                value={dafConfig.capitalGainsRate}
                onChange={(e) => setDafConfig((c) => ({ ...c, capitalGainsRate: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              />
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
        </div>
      )}

      {/* Liquidity Panel */}
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
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setLiquidityConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
                />
              </div>
            ))}
            <div className="flex items-center gap-2 col-span-2">
              <input
                type="checkbox"
                id="ilit2035"
                checked={liquidityConfig.ilitSection2035Flag}
                onChange={(e) => setLiquidityConfig((c) => ({ ...c, ilitSection2035Flag: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="ilit2035" className="text-sm text-gray-600">ILIT §2035 flag active (exclude from liquidity)</label>
            </div>
          </div>
          {liquidityResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Tax Burden</span><span className="font-medium text-red-600">{fmt(liquidityResult.totalTaxBurden)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Liquidity</span><span className="font-medium">{fmt(liquidityResult.totalLiquidity)}</span></div>
              {liquidityResult.totalTaxBurden === 0 ? (
                <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-800">
                  No estate tax projected under the current scenario. Switch to the No Exemption stress scenario
                  in the Tax tab to model liquidity under a taxable estate.
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
        </div>
      )}

      {/* Roth Panel */}
      {activePanel === 'roth' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Roth Conversion Analysis</h4>
          {rothBalance > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-blue-800">Client actuals (from base case)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-blue-700">
                <span>Current Roth balance</span>
                <span className="text-right font-medium">${Math.round(rothBalance).toLocaleString()}</span>
                <span>Pre-tax IRA balance</span>
                <span className="text-right font-medium">${Math.round(preIRABalance).toLocaleString()}</span>
                <span>Annual RMD</span>
                <span className="text-right font-medium">${Math.round(annualRMD).toLocaleString()}</span>
              </div>
              <p className="text-blue-500 pt-1">Parameters below are pre-filled from client data. Adjust to model conversion scenarios.</p>
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
                <input
                  type="number"
                  step={step ?? 1}
                  value={value}
                  onChange={(e) => setRothConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          {rothResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Conversion Tax Cost</span><span className="font-medium text-red-600">{fmt(rothResult.totalConversionTaxCost)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Projected Roth at Death</span><span className="font-medium">{fmt(rothResult.projectedRothBalanceAtDeath)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Estate Reduction from Tax Payment</span><span className="font-medium text-green-700">{fmt(rothResult.estateReductionFromTaxPayment)}</span></div>
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
                <span className={rothResult.conversionIsNPVPositive ? 'text-green-700' : 'text-gray-700'}>
                  NPV Benefit to Beneficiaries
                </span>
                <span className={rothResult.conversionIsNPVPositive ? 'text-green-700' : 'text-red-600'}>
                  {fmt(rothResult.npvBenefitToBeneficiaries)}
                </span>
              </div>
              {rothResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
