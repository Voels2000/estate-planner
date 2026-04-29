'use client'

// Sprint 70 — CompositeOverlay
// Shows all active strategies combined in a single waterfall view
// Side-by-side: baseline vs all strategies applied
// Validates no double-counting across strategy layers
// Wires hasCSTStrategy to EstateFlowDiagram (replaces false placeholder from Sprint 67)

import { useCallback, useEffect, useState } from 'react'
import {
  validateStrategyComposability,
  build30MArchetype,
  build100MArchetype,
  StrategyLayer,
} from '@/lib/strategy/validateComposability'

interface CompositeOverlayProps {
  grossEstate: number
  federalExemption: number
  estimatedFederalTax: number
  lawScenario: 'current_law' | 'no_exemption'
  householdId?: string
}

const ESTATE_TAX_RATE = 0.40

function calcTax(estate: number, exemption: number, lawScenario: string): number {
  const effectiveExemption =
    lawScenario === 'no_exemption' ? 0 : exemption
  return Math.max(0, estate - effectiveExemption) * ESTATE_TAX_RATE
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

function formatStrategyName(source: string, scenarioName: string | null): string {
  const names: Record<string, string> = {
    slat: 'SLAT',
    ilit: 'ILIT Death Benefit',
    grat: 'GRAT',
    annual_gifting: 'Annual Gifting',
    cst: 'Credit Shelter Trust',
    roth: 'Roth Conversion',
    daf: 'DAF',
    crt: 'CRT',
    clat: 'CLAT',
  }
  const base = names[source] ?? source
  return scenarioName ? `${base} (${scenarioName})` : base
}

function strategySourceToAsset(source: string): StrategyLayer['assetSource'] {
  const map: Record<string, StrategyLayer['assetSource']> = {
    slat: 'investment_portfolio',
    ilit: 'life_insurance',
    grat: 'investment_portfolio',
    annual_gifting: 'cash',
    cst: 'investment_portfolio',
    roth: 'pre_tax_retirement',
  }
  return map[source] ?? 'cash'
}

export default function CompositeOverlay({
  grossEstate,
  federalExemption,
  estimatedFederalTax,
  lawScenario,
  householdId,
}: CompositeOverlayProps) {
  const [mode, setMode] = useState<'custom' | 'recommendations' | '30m' | '100m'>('custom')
  const [customStrategies, setCustomStrategies] = useState<StrategyLayer[]>([
    { name: 'Annual Gifting', estateReduction: 0, assetSource: 'cash' },
    { name: 'Credit Shelter Trust', estateReduction: 0, assetSource: 'investment_portfolio' },
    { name: 'SLAT', estateReduction: 0, assetSource: 'real_estate' },
    { name: 'ILIT Death Benefit', estateReduction: 0, assetSource: 'life_insurance' },
  ])
  const [recommendedItems, setRecommendedItems] = useState<Array<{
    id: string
    strategy_source: string
    amount: number
    sign: number
    scenario_name: string | null
    consumer_accepted?: boolean
    consumer_rejected?: boolean
  }>>([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null)

  const loadRecommendations = useCallback(async () => {
    if (!householdId) return
    setIsLoadingRecommendations(true)
    setRecommendationsError(null)
    try {
      const res = await fetch('/api/advisor/strategy-recommendations-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setRecommendationsError(data.error ?? 'Failed to load recommendations')
        return
      }
      setRecommendedItems(data.items ?? [])
    } catch {
      setRecommendationsError('Unexpected error loading recommendations')
    } finally {
      setIsLoadingRecommendations(false)
    }
  }, [householdId])

  useEffect(() => {
    if (mode === 'recommendations') loadRecommendations()
  }, [mode, loadRecommendations])

  const activeRecommendedItems = recommendedItems.filter((item) => !item.consumer_rejected)
  const rejectedRecommendedItems = recommendedItems.filter((item) => item.consumer_rejected)

  const recommendedStrategies: StrategyLayer[] = activeRecommendedItems.map((item) => ({
    name: formatStrategyName(item.strategy_source, item.scenario_name),
    estateReduction: Math.abs(item.amount) * (item.sign < 0 ? 1 : -1),
    assetSource: strategySourceToAsset(item.strategy_source),
  }))

  // Get active strategies based on mode
  const activeConfig =
    mode === '30m'
      ? build30MArchetype(federalExemption)
      : mode === '100m'
        ? build100MArchetype(federalExemption)
        : mode === 'recommendations'
          ? { grossEstate, strategies: recommendedStrategies, federalExemption }
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
            ...(householdId ? [{ id: 'recommendations' as const, label: 'From Recommendations' }] : []),
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

      {mode === 'recommendations' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">Advisor Recommendations</h4>
            <button
              type="button"
              onClick={loadRecommendations}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>
          {isLoadingRecommendations && (
            <div className="text-sm text-gray-500">Loading recommendations...</div>
          )}
          {recommendationsError && (
            <p className="text-xs text-red-600">{recommendationsError}</p>
          )}
          {!isLoadingRecommendations && !recommendationsError && recommendedItems.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">No advisor recommendations yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Use the strategy panels above and mark items as recommended.
              </p>
            </div>
          )}
          {activeRecommendedItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Active — pending client approval
              </p>
              {activeRecommendedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {formatStrategyName(item.strategy_source, item.scenario_name)}
                    </span>
                    {item.consumer_accepted ? (
                      <span className="rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                        ✓ Client accepted
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600">
                        Pending
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      item.sign < 0 ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {item.sign < 0 ? '-' : '+'}${Math.abs(item.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
          {rejectedRecommendedItems.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                Declined by client
              </p>
              {rejectedRecommendedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded border border-red-100 bg-red-50 px-3 py-2 text-sm opacity-75"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-500 line-through">
                      {formatStrategyName(item.strategy_source, item.scenario_name)}
                    </span>
                    <span className="rounded-full border border-red-200 bg-red-100 px-1.5 py-0.5 text-xs text-red-500">
                      Client declined
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    ${Math.abs(item.amount).toLocaleString()}
                  </span>
                </div>
              ))}
              <p className="mt-1 text-xs text-gray-400">
                Declined strategies are excluded from waterfall/composability output.
              </p>
            </div>
          )}
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
              Scenario est.: {fmt(estimatedFederalTax)} · Model baseline: {fmt(baselineTax)} → With
              strategies: {fmt(strategyTax)}
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
    </div>
  )
}
