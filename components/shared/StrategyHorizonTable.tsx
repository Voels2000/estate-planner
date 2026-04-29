'use client'

/**
 * StrategyHorizonTable — shared advisor + consumer component.
 *
 * Advisor mode: shows base case vs all advisor-recommended strategies.
 * Consumer mode: adds Accept / Reject controls for pending advisor items.
 */

import { useMemo } from 'react'
import {
  validateStrategyComposability,
  type StrategyLayer,
} from '@/lib/strategy/validateComposability'
import type { MyEstateStrategyHorizonsResult } from '@/lib/my-estate-strategy/horizonSnapshots'

export interface PendingAdvisorItem {
  id: string
  strategy_source: string
  amount: number
  sign: number
  scenario_name: string | null
  consumer_accepted: boolean
  consumer_rejected: boolean
}

interface StrategyHorizonTableProps {
  horizons: MyEstateStrategyHorizonsResult
  pendingItems: PendingAdvisorItem[]
  federalExemption: number
  mode: 'advisor' | 'consumer'
  onAccept?: (item: PendingAdvisorItem) => void | Promise<void>
  onReject?: (item: PendingAdvisorItem) => void | Promise<void>
  actionSaving?: string | null
}

const STRATEGY_LABELS: Record<string, string> = {
  slat: 'SLAT',
  ilit: 'ILIT Death Benefit',
  grat: 'GRAT',
  annual_gifting: 'Annual Gifting',
  cst: 'Credit Shelter Trust',
  revocable_trust: 'Revocable Trust',
  roth: 'Roth Conversion',
  daf: 'Donor Advised Fund',
  crt: 'Charitable Remainder Trust',
  clat: 'Charitable Lead Annuity Trust',
  liquidity: 'Estate Liquidity',
}

function formatStrategyLabel(source: string, scenarioName: string | null): string {
  const base = STRATEGY_LABELS[source] ?? source
  return scenarioName ? `${base} (${scenarioName})` : base
}

function strategySourceToAsset(source: string): StrategyLayer['assetSource'] {
  const map: Record<string, StrategyLayer['assetSource']> = {
    slat: 'investment_portfolio',
    ilit: 'life_insurance',
    grat: 'investment_portfolio',
    annual_gifting: 'cash',
    cst: 'investment_portfolio',
    revocable_trust: 'investment_portfolio',
    roth: 'pre_tax_retirement',
    liquidity: 'cash',
  }
  return map[source] ?? 'cash'
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
const ESTATE_TAX_RATE = 0.4
const calcTax = (estate: number, exemption: number) => Math.max(0, estate - exemption) * ESTATE_TAX_RATE

export default function StrategyHorizonTable({
  horizons,
  pendingItems,
  federalExemption,
  mode,
  onAccept,
  onReject,
  actionSaving,
}: StrategyHorizonTableProps) {
  const strategyLayers: StrategyLayer[] = useMemo(
    () =>
      pendingItems
        .filter((item) => !item.consumer_rejected)
        .map((item) => ({
          name: formatStrategyLabel(item.strategy_source, item.scenario_name),
          estateReduction: Math.abs(item.amount),
          assetSource: strategySourceToAsset(item.strategy_source),
        })),
    [pendingItems],
  )

  const columns = [horizons.today, horizons.tenYear, horizons.twentyYear, horizons.atDeath]
  const showStateTax = columns.some((col) => col.stateTax !== null && col.stateTax > 0)

  const horizonRows = useMemo(
    () =>
      columns.map((col) => {
        const grossEstate = col.grossEstate ?? 0
        const federalTaxBase = col.federalTaxEstimate ?? calcTax(grossEstate, federalExemption)
        const stateTaxBase = col.stateTax ?? 0
        const totalTaxBase = federalTaxBase + (showStateTax ? stateTaxBase : 0)
        const netBase = Math.max(0, grossEstate - totalTaxBase)

        const result = validateStrategyComposability(grossEstate, federalExemption, strategyLayers)
        const strategyGross = result.adjustedEstate
        const strategyFederalTax = calcTax(strategyGross, federalExemption)
        const stateTaxRatio = grossEstate > 0 ? strategyGross / grossEstate : 1
        const strategyStateTax = stateTaxBase * stateTaxRatio
        const strategyTotalTax = strategyFederalTax + (showStateTax ? strategyStateTax : 0)
        const netWithStrategies = Math.max(0, strategyGross - strategyTotalTax)

        return {
          label: col.headerTitle,
          grossBase: grossEstate,
          federalTaxBase,
          stateTaxBase,
          netBase,
          netWithStrategies,
          deltaNet: netWithStrategies - netBase,
        }
      }),
    [columns, federalExemption, showStateTax, strategyLayers],
  )

  const hasStrategies = strategyLayers.length > 0
  const acceptedItems = pendingItems.filter((i) => i.consumer_accepted && !i.consumer_rejected)
  const awaitingItems = pendingItems.filter((i) => !i.consumer_accepted && !i.consumer_rejected)

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-40 px-4 py-2.5 text-left font-medium text-gray-600">Horizon</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Gross Estate</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Fed. Est. Tax</th>
              {showStateTax && <th className="px-4 py-2.5 text-right font-medium text-gray-600">State Tax</th>}
              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Net to Heirs</th>
              {hasStrategies && (
                <th className="px-4 py-2.5 text-right font-medium text-blue-600">
                  With Strategies
                  {mode === 'consumer' && awaitingItems.length > 0 && (
                    <span className="ml-1 text-xs font-normal text-amber-500">illustrative</span>
                  )}
                </th>
              )}
              {hasStrategies && <th className="px-4 py-2.5 text-right font-medium text-green-600">Delta</th>}
            </tr>
          </thead>
          <tbody>
            {horizonRows.map((row, i) => (
              <tr
                key={row.label}
                className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
              >
                <td className="px-4 py-2.5 font-medium text-gray-700">{row.label}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{fmt(row.grossBase)}</td>
                <td className="px-4 py-2.5 text-right text-red-600">{fmt(row.federalTaxBase)}</td>
                {showStateTax && <td className="px-4 py-2.5 text-right text-red-500">{fmt(row.stateTaxBase)}</td>}
                <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(row.netBase)}</td>
                {hasStrategies && (
                  <td className="px-4 py-2.5 text-right font-semibold text-blue-700">{fmt(row.netWithStrategies)}</td>
                )}
                {hasStrategies && (
                  <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                    {row.deltaNet > 0 ? '+' : ''}
                    {fmt(row.deltaNet)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mode === 'consumer' && pendingItems.length > 0 && (
        <div className="space-y-4">
          {awaitingItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formatStrategyLabel(item.strategy_source, item.scenario_name)}
                </p>
                <p className="mt-0.5 text-xs text-amber-700">Est. reduction: {fmt(Math.abs(item.amount))}</p>
              </div>
              <div className="ml-4 flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={actionSaving === item.id}
                  onClick={() => onReject?.(item)}
                  className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={actionSaving === item.id}
                  onClick={() => onAccept?.(item)}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {actionSaving === item.id ? 'Saving...' : 'Accept'}
                </button>
              </div>
            </div>
          ))}
          {acceptedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formatStrategyLabel(item.strategy_source, item.scenario_name)}
                </p>
                <p className="mt-0.5 text-xs text-green-700">{fmt(Math.abs(item.amount))} confirmed</p>
              </div>
              <span className="rounded-full border border-green-200 bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                Confirmed
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
