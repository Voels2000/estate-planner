'use client'

// Sprint 70 — CompositeOverlay
// Shows all active strategies combined in a single waterfall view
// Side-by-side: baseline vs all strategies applied
// Validates no double-counting across strategy layers
// Wires hasCSTStrategy to EstateFlowDiagram (replaces false placeholder from Sprint 67)

import { useState } from 'react'
import {
  validateStrategyComposability,
  build30MArchetype,
  build100MArchetype,
  StrategyLayer,
} from '@/lib/strategy/validateComposability'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'

interface CompositeOverlayProps {
  householdId: string
  grossEstate: number
  federalExemption: number
  estimatedFederalTax: number
  lawScenario: 'current_law' | 'sunset' | 'no_exemption'
}

const ESTATE_TAX_RATE = 0.40

function calcTax(estate: number, exemption: number, lawScenario: string): number {
  const effectiveExemption =
    lawScenario === 'sunset'
      ? Math.min(exemption, 7_000_000)
      : lawScenario === 'no_exemption'
        ? 0
        : exemption
  return Math.max(0, estate - effectiveExemption) * ESTATE_TAX_RATE
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`

export default function CompositeOverlay({
  householdId,
  grossEstate,
  federalExemption,
  estimatedFederalTax,
  lawScenario,
}: CompositeOverlayProps) {
  const [mode, setMode] = useState<'custom' | '30m' | '100m'>('custom')
  const [customStrategies, setCustomStrategies] = useState<StrategyLayer[]>([
    { name: 'Annual Gifting', estateReduction: 0, assetSource: 'cash' },
    { name: 'Credit Shelter Trust', estateReduction: 0, assetSource: 'investment_portfolio' },
    { name: 'SLAT', estateReduction: 0, assetSource: 'real_estate' },
    { name: 'ILIT Death Benefit', estateReduction: 0, assetSource: 'life_insurance' },
  ])

  // Get active strategies based on mode
  const activeConfig =
    mode === '30m'
      ? build30MArchetype(federalExemption)
      : mode === '100m'
        ? build100MArchetype(federalExemption)
        : { grossEstate, strategies: customStrategies.filter((s) => s.estateReduction > 0), federalExemption }

  const result = validateStrategyComposability(
    activeConfig.grossEstate,
    activeConfig.federalExemption,
    activeConfig.strategies
  )

  const baselineTax = calcTax(activeConfig.grossEstate, federalExemption, lawScenario)
  const strategyTax = calcTax(result.adjustedEstate, federalExemption, lawScenario)

  // Waterfall bar width calculation
  const maxEstate = activeConfig.grossEstate
  const barWidth = (val: number) => `${Math.min(100, (val / maxEstate) * 100).toFixed(1)}%`

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Composite Strategy View</h3>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'custom' as const, label: 'This Household' },
            { id: '30m' as const, label: '$30M Archetype' },
            { id: '100m' as const, label: '$100M Archetype' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                mode === m.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom strategy inputs */}
      {mode === 'custom' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Enter Strategy Reductions</h4>
          <p className="text-xs text-gray-500">
            Enter the estate reduction amount for each strategy active for this household. Leave at 0 to exclude
            from composite.
          </p>
          <div className="space-y-3">
            {customStrategies.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 items-center">
                <span className="text-sm text-gray-700">{s.name}</span>
                <input
                  type="number"
                  placeholder="Estate reduction ($)"
                  value={s.estateReduction || ''}
                  onChange={(e) => {
                    const updated = [...customStrategies]
                    updated[i] = { ...updated[i], estateReduction: Number(e.target.value) }
                    setCustomStrategies(updated)
                  }}
                  className="col-span-2 border border-gray-200 rounded px-3 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Double-counting warnings */}
      {result.hasDoubleCountingRisk && (
        <div className="space-y-2">
          {result.doubleCountingWarnings.map((w, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Waterfall Chart */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-800">Estate Waterfall</h4>

        {/* Baseline bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Gross Estate (Baseline)</span>
            <span>{fmt(activeConfig.grossEstate)}</span>
          </div>
          <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gray-400 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Strategy layers */}
        {result.strategyBreakdown.map((s, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>After {s.name}</span>
              <span className="text-green-700">
                &#x2212;{fmt(s.reduction)} → {fmt(s.cumulativeEstate)}
              </span>
            </div>
            <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: barWidth(s.cumulativeEstate) }}
              />
            </div>
          </div>
        ))}

        {/* Tax bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Estate Tax ({lawScenario.replace('_', ' ')})</span>
            <span className="text-red-600">
              Baseline: {fmt(baselineTax)} → With strategies: {fmt(strategyTax)}
            </span>
          </div>
          <div className="h-5 bg-gray-100 rounded-full overflow-hidden relative">
            <div className="h-full bg-red-300 rounded-full" style={{ width: barWidth(baselineTax) }} />
            <div className="absolute inset-0 h-full bg-red-500 rounded-full" style={{ width: barWidth(strategyTax) }} />
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-2 px-4 font-medium text-gray-600">Metric</th>
              <th className="text-right py-2 px-4 font-medium text-gray-600">Baseline</th>
              <th className="text-right py-2 px-4 font-medium text-blue-600">With Strategies</th>
              <th className="text-right py-2 px-4 font-medium text-green-600">Savings</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-4 text-gray-700">Gross Estate</td>
              <td className="py-2 px-4 text-right">{fmt(activeConfig.grossEstate)}</td>
              <td className="py-2 px-4 text-right text-blue-700">{fmt(result.adjustedEstate)}</td>
              <td className="py-2 px-4 text-right text-green-700">{fmt(result.totalReduction)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-4 text-gray-700">Estate Tax</td>
              <td className="py-2 px-4 text-right text-red-600">{fmt(baselineTax)}</td>
              <td className="py-2 px-4 text-right text-red-400">{fmt(strategyTax)}</td>
              <td className="py-2 px-4 text-right text-green-700">{fmt(baselineTax - strategyTax)}</td>
            </tr>
            <tr className="bg-gray-50 font-semibold">
              <td className="py-2 px-4 text-gray-900">Net to Heirs</td>
              <td className="py-2 px-4 text-right">{fmt(result.netToHeirsBaseline)}</td>
              <td className="py-2 px-4 text-right text-blue-700">{fmt(result.netToHeirsWithStrategies)}</td>
              <td className="py-2 px-4 text-right text-green-700">
                {fmt(result.netToHeirsWithStrategies - result.netToHeirsBaseline)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Advisory notes */}
      {result.advisoryNotes.map((note, i) => (
        <div
          key={i}
          className={`rounded p-3 text-xs ${
            note.startsWith('⚠️')
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-blue-50 border border-blue-100 text-blue-800'
          }`}
        >
          {note}
        </div>
      ))}

      <DisclaimerBanner />
    </div>
  )
}
