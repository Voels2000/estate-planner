'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import ConsumerStrategyPanel from '@/components/consumer/ConsumerStrategyPanel'
import { TrustDocumentsPanel } from '@/components/consumer/TrustDocumentsPanel'
import type {
  TrustRow,
  TrustWillChecklistItem,
  TrustWillRecommendation,
} from '@/lib/trusts/types'
import type { EstateContext } from '@/components/consumer/ConsumerStrategyPanel'
import type { CharitableHouseholdContext } from '@/lib/charitable/buildPersonalizedCharitableTopics'
import StrategyHorizonTable, { type PendingAdvisorItem } from '@/components/shared/StrategyHorizonTable'
import type { OutsideStrategyItem } from '@/lib/estate/types'
import type { MyEstateStrategyHorizonsResult } from '@/lib/my-estate-strategy/horizonSnapshots'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import type { GiftingSummary } from '@/components/GiftingDashboard'

type AdvisorLineItem = {
  id?: string
  strategy_source: string
  amount: number
  sign: number
  confidence_level: string
  effective_year: number | null
  metadata: Record<string, unknown> | null
  scenario_name?: string | null
  consumer_accepted?: boolean
  consumer_rejected?: boolean
}

const GiftingDashboard = dynamic(() => import('@/components/GiftingDashboard'), { ssr: false })
const CharitableGivingDashboard = dynamic(() => import('@/components/CharitableGivingDashboard'), {
  ssr: false,
})

type Tab = 'gifting' | 'charitable' | 'strategies' | 'trusts'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'gifting', label: 'Annual Gifting', icon: '🎁' },
  { id: 'charitable', label: 'Charitable Giving', icon: '❤️' },
  { id: 'strategies', label: 'Transfer Strategies', icon: '🏛️' },
  { id: 'trusts', label: 'Trusts & Documents', icon: '📋' },
]

interface Props {
  householdId: string
  ownerUserId: string
  userRole: 'consumer' | 'advisor'
  consumerTier: number
  estateContext?: EstateContext
  initialTab: string
  advisorRecommendations: { strategy_type: string; label: string | null }[]
  advisorLineItems: AdvisorLineItem[]
  consumerLineItems?: Array<{
    id?: string
    strategy_source: string
    amount: number
    sign: number
    confidence_level: string
    effective_year: number | null
    scenario_name?: string | null
  }>
  advisorHorizons?: MyEstateStrategyHorizonsResult | null
  strategyImpact: {
    strategyItems: OutsideStrategyItem[]
    strategyReductionTotal: number
    taxWithoutStrategies: number
    taxWithStrategies: number
    taxSavings: number
  }
  giftingScenario: {
    filing: 'single' | 'married_joint'
    giftingAnnualUsed: number | null
    giftingAnnualRemaining: number | null
    giftingAnnualLoggedTotal: number | null
    giftingTaxYear: number
    giftingSplitSelected: boolean
    giftingPerRecipientLimit: number | null
    giftingExcessOverLimit: number | null
  }
  initialGiftingSummary?: GiftingSummary | null
  trustWillGuidance: {
    estateValue: number
    recommendations: TrustWillRecommendation[]
    checklist: TrustWillChecklistItem[]
    trusts: TrustRow[]
  }
  trustEstateSummary?: {
    estimatedTaxableEstate: number
    federalExemptionRemaining: number
    lifetimeGiftsUsed: number
    headroom: number
  }
  marginalStateEstateRatePct?: number
  charitableHouseholdContext?: CharitableHouseholdContext | null
}

const ADVISOR_STRATEGY_LABELS: Record<string, string> = {
  gifting: 'Annual Gifting Program',
  revocable_trust: 'Revocable Living Trust',
  credit_shelter_trust: 'Credit Shelter Trust (CST)',
  grat: 'Grantor Retained Annuity Trust (GRAT)',
  crt: 'Charitable Remainder Trust (CRT)',
  clat: 'Charitable Lead Annuity Trust (CLAT)',
  daf: 'Donor Advised Fund (DAF)',
  roth: 'Roth Conversion',
  liquidity: 'Estate Liquidity Planning',
}

function toDisplayStrategyLabel(strategyType: string, label: string | null): string {
  return label ?? ADVISOR_STRATEGY_LABELS[strategyType] ?? strategyType
}

export default function MyEstateTrustStrategyClient({
  householdId,
  ownerUserId,
  userRole,
  consumerTier,
  estateContext,
  initialTab,
  advisorRecommendations,
  advisorLineItems,
  consumerLineItems = [],
  advisorHorizons,
  strategyImpact,
  giftingScenario,
  initialGiftingSummary,
  trustWillGuidance,
  trustEstateSummary,
  marginalStateEstateRatePct = 0,
  charitableHouseholdContext = null,
}: Props) {
  const router = useRouter()
  const validTabs: Tab[] = ['gifting', 'charitable', 'strategies', 'trusts']
  const startTab = validTabs.includes(initialTab as Tab) ? (initialTab as Tab) : 'gifting'
  const [activeTab, setActiveTab] = useState<Tab>(startTab)

  function selectTab(tab: Tab) {
    setActiveTab(tab)
    router.replace(`/my-estate-trust-strategy?tab=${tab}`, { scroll: false })
  }

  const [annualGiftingInput, setAnnualGiftingInput] = useState<number | null>(null)
  const [giftingYears, setGiftingYears] = useState(10)
  const [pendingItems, setPendingItems] = useState<PendingAdvisorItem[]>(
    (advisorLineItems ?? []).map((item) => ({
      id: item.id ?? '',
      strategy_source: item.strategy_source,
      amount: item.amount,
      sign: item.sign,
      scenario_name: item.scenario_name ?? null,
      consumer_accepted: item.consumer_accepted ?? false,
      consumer_rejected: item.consumer_rejected ?? false,
    })),
  )
  const [actionSaving, setActionSaving] = useState<string | null>(null)
  const [giftingScenarioLabel, setGiftingScenarioLabel] = useState('Annual Gifting Program')
  const [giftingSaving, setGiftingSaving] = useState(false)
  const [giftingSaveMessage, setGiftingSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [showScenarioComparison, setShowScenarioComparison] = useState(false)
  const [comparisonLabel, setComparisonLabel] = useState('Conservative Plan')
  const [comparisonAnnualGifting, setComparisonAnnualGifting] = useState<number | null>(null)
  const [comparisonYears, setComparisonYears] = useState(5)
  const [comparisonSaving, setComparisonSaving] = useState(false)
  const [comparisonSaveMessage, setComparisonSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [removingStrategy, setRemovingStrategy] = useState<string | null>(null)
  const [removeMessage, setRemoveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  function formatDollars(n: number) {
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
  }

  const confidenceColors: Record<string, string> = {
    certain: 'bg-green-100 text-green-800 border-green-200',
    probable: 'bg-blue-100 text-blue-800 border-blue-200',
    illustrative: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const recommendedAnnualGifting =
    giftingScenario.filing === 'married_joint' && giftingScenario.giftingSplitSelected ? 38000 : 19000

  const annualGifting =
    annualGiftingInput ??
    (giftingScenario.giftingAnnualUsed != null && giftingScenario.giftingAnnualUsed > 0
      ? Math.round(giftingScenario.giftingAnnualUsed)
      : recommendedAnnualGifting)

  const syncedEligibleAnnual = Math.max(0, giftingScenario.giftingAnnualUsed ?? 0)
  const syncedLifetimeOverflow = Math.max(0, giftingScenario.giftingExcessOverLimit ?? 0)
  const syncedGiftTotalReduction = syncedEligibleAnnual + syncedLifetimeOverflow
  const useSyncedGifting = syncedGiftTotalReduction > 0
  const effectiveAnnualGifting = useSyncedGifting ? syncedGiftTotalReduction : annualGifting
  const effectiveGiftingYears = useSyncedGifting ? 1 : giftingYears

  async function handleAccept(item: PendingAdvisorItem) {
    setActionSaving(item.id)
    await fetch('/api/consumer/strategy-recommendation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineItemId: item.id, householdId }),
    })
    setPendingItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, consumer_accepted: true } : i)),
    )
    setActionSaving(null)
  }

  async function handleReject(item: PendingAdvisorItem) {
    setActionSaving(item.id)
    await fetch('/api/consumer/strategy-recommendation', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineItemId: item.id, householdId }),
    })
    setPendingItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, consumer_rejected: true } : i)),
    )
    setActionSaving(null)
  }

  async function handleSaveGiftingScenario() {
    setGiftingSaving(true)
    setGiftingSaveMessage(null)
    try {
      const res = await fetch('/api/strategy-line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          strategy_source: 'annual_gifting',
          source_role: 'consumer',
          category: 'gifting',
          scenario_name: giftingScenarioLabel.trim() || 'Annual Gifting Program',
          amount: effectiveAnnualGifting * effectiveGiftingYears,
          sign: -1,
          confidence_level: 'probable',
          effective_year: new Date().getFullYear(),
          metadata: {
            annual_amount: effectiveAnnualGifting,
            years: effectiveGiftingYears,
            synced_from_gift_history: useSyncedGifting,
          },
        }),
      })
      if (res.ok) {
        setGiftingSaveMessage({
          type: 'success',
          text: 'Gifting program saved to your plan.',
        })
        router.refresh()
      } else {
        const data = await res.json()
        setGiftingSaveMessage({
          type: 'error',
          text: data.error ?? 'Failed to save gifting program.',
        })
      }
    } catch {
      setGiftingSaveMessage({ type: 'error', text: 'Unexpected error — please try again.' })
    } finally {
      setGiftingSaving(false)
    }
  }

  async function handleSaveComparisonScenario() {
    const amount = (comparisonAnnualGifting ?? annualGifting) * comparisonYears
    if (amount <= 0) return
    setComparisonSaving(true)
    setComparisonSaveMessage(null)
    try {
      const res = await fetch('/api/strategy-line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          strategy_source: 'annual_gifting',
          source_role: 'consumer',
          category: 'gifting',
          amount,
          sign: -1,
          confidence_level: 'probable',
          effective_year: new Date().getFullYear(),
          scenario_name: comparisonLabel.trim() || 'Alternative Gifting Plan',
        }),
      })
      if (res.ok) {
        setComparisonSaveMessage({ type: 'success', text: 'Comparison scenario saved.' })
        router.refresh()
      } else {
        const data = await res.json()
        setComparisonSaveMessage({
          type: 'error',
          text: data.error ?? 'Failed to save.',
        })
      }
    } catch {
      setComparisonSaveMessage({
        type: 'error',
        text: 'Unexpected error — please try again.',
      })
    } finally {
      setComparisonSaving(false)
    }
  }

  async function handleRemoveConsumerStrategy(
    strategySource: string,
    scenarioName: string | null | undefined,
  ) {
    const confirmed = window.confirm(
      'Remove this strategy from your plan? This will update your estate projections.',
    )
    if (!confirmed) return

    const removeKey = `${strategySource}::${scenarioName ?? ''}`
    setRemovingStrategy(removeKey)
    setRemoveMessage(null)
    try {
      const res = await fetch('/api/strategy-line-items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          strategySource,
          scenarioName: scenarioName ?? null,
          source_role: 'consumer',
        }),
      })
      if (res.ok) {
        setRemoveMessage({ type: 'success', text: 'Strategy removed from your plan.' })
        router.refresh()
      } else {
        const data = await res.json()
        setRemoveMessage({
          type: 'error',
          text: data.error ?? 'Failed to remove strategy.',
        })
      }
    } catch {
      setRemoveMessage({ type: 'error', text: 'Unexpected error — please try again.' })
    } finally {
      setRemovingStrategy(null)
    }
  }

  return (
    <div className="space-y-6">
      {advisorHorizons && pendingItems.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Estate Strategy Impact</h2>
          <p className="mb-4 text-sm text-gray-500">
            Review how your advisor&apos;s recommendations affect your estate across each planning horizon.
          </p>
          <StrategyHorizonTable
            horizons={advisorHorizons}
            pendingItems={pendingItems}
            federalExemption={estateContext?.federalExemption ?? 15_000_000}
            mode="consumer"
            onAccept={handleAccept}
            onReject={handleReject}
            actionSaving={actionSaving}
          />
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gifting, Strategies & Trusts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your gifting program, estate transfer strategies, and trusts in one place.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'gifting' && (
        <div className="space-y-4">
          <GiftingDashboard
            householdId={householdId}
            userRole={userRole}
            consumerTier={consumerTier}
            initialGiftingSummary={initialGiftingSummary}
          />
          <CollapsibleSection
            title="Gifting scenario"
            subtitle={
              giftingScenario.filing === 'married_joint'
                ? giftingScenario.giftingSplitSelected
                  ? 'Annual gifting limit: $38,000 with gift-splitting consent on file'
                  : 'Annual gifting limit: $19,000 (gift-splitting not selected)'
                : 'Annual gifting limit: $19,000 per donee'
            }
            defaultOpen={false}
            storageKey="gifting-strategy-gifting-scenario"
          >
            <p className="mb-4 text-xs text-neutral-500">
              Annual gifting reduces the taxable estate. Married couples may elect gift-splitting
              up to $38,000 per donee by filing Form 709 consenting to split gifts.
            </p>

            {giftingScenario.giftingAnnualUsed != null && giftingScenario.giftingAnnualRemaining != null && (
              <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
                <p className="font-medium text-neutral-800">
                  Gifting Strategy sync ({giftingScenario.giftingTaxYear})
                </p>
                <p className="mt-1">
                  Eligible annual gifts: {formatDollars(giftingScenario.giftingAnnualUsed)}.
                  {giftingScenario.giftingPerRecipientLimit != null && (
                    <> Per-recipient limit: {formatDollars(giftingScenario.giftingPerRecipientLimit)}
                    {giftingScenario.giftingSplitSelected ? ' (split-gifting).' : '.'}</>
                  )}
                </p>
                {giftingScenario.giftingAnnualLoggedTotal != null && (
                  <p className="mt-1">Total annual gifts logged: {formatDollars(giftingScenario.giftingAnnualLoggedTotal)}.</p>
                )}
                {(giftingScenario.giftingExcessOverLimit ?? 0) > 0 && (
                  <p className="mt-1 text-amber-700">
                    {formatDollars(giftingScenario.giftingExcessOverLimit ?? 0)} exceeds the per-recipient annual limit.
                  </p>
                )}
              </div>
            )}

            <div className="mb-2">
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Program name <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <input
                type="text"
                value={giftingScenarioLabel}
                onChange={(e) => setGiftingScenarioLabel(e.target.value)}
                placeholder="e.g. College gifting plan"
                maxLength={60}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 sm:max-w-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Annual gift amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={annualGifting}
                  onChange={(e) => setAnnualGiftingInput(Math.max(0, Number(e.target.value) || 0))}
                  className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Years of gifting</label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  step="1"
                  value={giftingYears}
                  onChange={(e) => setGiftingYears(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
                  className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
              </div>
              <div className="flex flex-col justify-end">
                <p className="mb-1 text-xs text-neutral-500">Total gifting reduction</p>
                <p className="text-2xl font-bold tabular-nums text-green-600">
                  {formatDollars(effectiveAnnualGifting * effectiveGiftingYears)}
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveGiftingScenario()}
                  disabled={giftingSaving || effectiveAnnualGifting * effectiveGiftingYears <= 0}
                  className="mt-3 inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {giftingSaving ? 'Saving…' : 'Save to my plan →'}
                </button>
                {giftingSaveMessage && (
                  <p
                    className={`mt-2 text-xs ${giftingSaveMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
                  >
                    {giftingSaveMessage.text}
                  </p>
                )}
              </div>
            </div>

            {/* Scenario comparison */}
            <div className="border-t border-neutral-200 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setShowScenarioComparison((s) => !s)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
              >
                {showScenarioComparison ? '▲ Hide comparison' : '▼ Compare a second scenario'}
              </button>

              {showScenarioComparison && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-3">
                      <label className="mb-1 block text-sm font-medium text-neutral-700">
                        Scenario name
                      </label>
                      <input
                        type="text"
                        value={comparisonLabel}
                        onChange={(e) => setComparisonLabel(e.target.value)}
                        placeholder="e.g. Conservative Plan"
                        maxLength={60}
                        className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 sm:max-w-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-neutral-700">
                        Annual gift amount ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={comparisonAnnualGifting ?? annualGifting}
                        onChange={(e) =>
                          setComparisonAnnualGifting(Math.max(0, Number(e.target.value) || 0))
                        }
                        className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-neutral-700">
                        Years of gifting
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="40"
                        step="1"
                        value={comparisonYears}
                        onChange={(e) =>
                          setComparisonYears(Math.max(1, Math.min(40, Number(e.target.value) || 1)))
                        }
                        className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <p className="mb-1 text-xs text-neutral-500">Total reduction</p>
                      <p className="text-2xl font-bold tabular-nums text-blue-600">
                        {formatDollars((comparisonAnnualGifting ?? annualGifting) * comparisonYears)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                        {giftingScenarioLabel || 'Primary Plan'}
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        {formatDollars(effectiveAnnualGifting * effectiveGiftingYears)}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {formatDollars(effectiveAnnualGifting)} × {effectiveGiftingYears} yr
                        {effectiveGiftingYears !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="border-l border-neutral-200 pl-3">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                        {comparisonLabel || 'Alternative Plan'}
                      </p>
                      <p className="text-xl font-bold text-blue-600">
                        {formatDollars((comparisonAnnualGifting ?? annualGifting) * comparisonYears)}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {formatDollars(comparisonAnnualGifting ?? annualGifting)} × {comparisonYears}{' '}
                        yr{comparisonYears !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="col-span-2 border-t border-neutral-200 pt-3 mt-1">
                      <p className="text-xs text-neutral-500">
                        Difference:{' '}
                        <span
                          className={`font-semibold ${
                            (comparisonAnnualGifting ?? annualGifting) * comparisonYears >
                            effectiveAnnualGifting * effectiveGiftingYears
                              ? 'text-blue-600'
                              : 'text-green-600'
                          }`}
                        >
                          {formatDollars(
                            Math.abs(
                              (comparisonAnnualGifting ?? annualGifting) * comparisonYears -
                                effectiveAnnualGifting * effectiveGiftingYears,
                            ),
                          )}{' '}
                          {(comparisonAnnualGifting ?? annualGifting) * comparisonYears >
                          effectiveAnnualGifting * effectiveGiftingYears
                            ? 'more in alternative'
                            : 'more in primary'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveComparisonScenario()}
                      disabled={
                        comparisonSaving ||
                        (comparisonAnnualGifting ?? annualGifting) * comparisonYears <= 0
                      }
                      className="inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {comparisonSaving ? 'Saving…' : 'Save comparison to plan →'}
                    </button>
                  </div>
                  {comparisonSaveMessage && (
                    <p
                      className={`text-xs ${comparisonSaveMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
                    >
                      {comparisonSaveMessage.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {activeTab === 'charitable' && (
        <CharitableGivingDashboard
          householdId={householdId}
          userRole={userRole}
          consumerTier={consumerTier}
          householdContext={charitableHouseholdContext}
        />
      )}

      {activeTab === 'strategies' && (
        <div className="space-y-4">
          {consumerLineItems.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-3 text-sm font-semibold text-emerald-900">Your Saved Strategies</p>
              <p className="mb-3 text-xs text-emerald-700">
                These strategies are part of your plan and are reflected in your estate horizons.
              </p>
              <div className="overflow-x-auto rounded-lg border border-emerald-100 bg-white">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="bg-emerald-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-emerald-900">Strategy</th>
                      <th className="px-3 py-2 text-right font-semibold text-emerald-900">Amount</th>
                      <th className="px-3 py-2 text-left font-semibold text-emerald-900">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {consumerLineItems.map((item, i) => (
                      <tr key={`${item.strategy_source}-${i}`} className="border-t border-emerald-100">
                        <td className="px-3 py-2 text-gray-900 capitalize">
                          {(item.scenario_name ?? item.strategy_source).replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-700">
                          −{formatDollars(Math.abs(item.amount))}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            In your plan
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              void handleRemoveConsumerStrategy(
                                item.strategy_source,
                                item.scenario_name,
                              )
                            }
                            disabled={
                              removingStrategy ===
                              `${item.strategy_source}::${item.scenario_name ?? ''}`
                            }
                            className="rounded border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {removingStrategy ===
                            `${item.strategy_source}::${item.scenario_name ?? ''}`
                              ? 'Removing…'
                              : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-emerald-200 bg-emerald-50">
                      <td className="px-3 py-2 text-xs font-semibold text-emerald-900">Total reduction</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700">
                        −{formatDollars(consumerLineItems.reduce((s, i) => s + Math.abs(i.amount), 0))}
                      </td>
                      <td />
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {removeMessage && (
                <p
                  className={`mt-2 text-xs ${removeMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
                >
                  {removeMessage.text}
                </p>
              )}
            </div>
          )}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="mb-3 text-sm font-semibold text-blue-900">
              Advisor Recommended Strategies
            </p>
            {advisorRecommendations.length === 0 ? (
              <p className="text-sm text-blue-700">
                No advisor-recommended strategies yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-blue-900">Strategy</th>
                      <th className="px-3 py-2 text-left font-semibold text-blue-900">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-blue-900">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advisorRecommendations.map((rec) => (
                      <tr key={rec.strategy_type} className="border-t border-blue-100">
                        <td className="px-3 py-2 text-gray-900">
                          {toDisplayStrategyLabel(rec.strategy_type, rec.label)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Recommended
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">Advisor</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {advisorRecommendations.length > 0 && (
              <p className="mt-3 text-xs text-blue-700">
                Contact your advisor to review implementation details for these strategies.
              </p>
            )}
          </div>
          {strategyImpact.strategyItems.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-neutral-900">Strategy impact</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Without strategies
                  </p>
                  <p className="text-xl font-bold text-neutral-900">
                    {formatDollars(strategyImpact.taxWithoutStrategies)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">Est. federal tax</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-green-700">
                    With strategies
                  </p>
                  <p className="text-xl font-bold text-green-700">
                    {formatDollars(strategyImpact.taxWithStrategies)}
                  </p>
                  <p className="mt-0.5 text-xs text-green-600">Est. federal tax</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-700">
                    Potential savings
                  </p>
                  <p className="text-xl font-bold text-blue-700">
                    {formatDollars(strategyImpact.taxSavings)}
                  </p>
                  <p className="mt-0.5 text-xs text-blue-600">Est. federal tax reduction</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Advisor-recommended strategies
                  </p>
                </div>
                <div className="divide-y divide-neutral-100">
                  {strategyImpact.strategyItems.map((item, i) => (
                    <div key={`${item.strategy_source}-${i}`} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium capitalize text-neutral-800">
                          {item.strategy_source.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`ml-2 inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${confidenceColors[item.confidence_level] ?? confidenceColors.illustrative}`}
                        >
                          {item.confidence_level.charAt(0).toUpperCase() + item.confidence_level.slice(1)}
                        </span>
                      </div>
                      <div className="ml-4 shrink-0 text-right">
                        <span className="text-sm font-semibold text-green-700">
                          −{formatDollars(item.amount)}
                        </span>
                        <p className="text-xs text-neutral-400">estate reduction</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="text-xs font-semibold text-neutral-700">
                    Total estate reduction (certain + probable)
                  </span>
                  <span className="text-sm font-bold text-green-700">
                    −{formatDollars(strategyImpact.strategyReductionTotal)}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-neutral-400">
                Illustrative strategies are excluded from the tax reduction calculation.
              </p>
            </div>
          )}
          <ConsumerStrategyPanel
            householdId={householdId}
            ownerUserId={ownerUserId}
            userRole={userRole}
            advisorLineItems={advisorLineItems}
            estateContext={estateContext}
            filingStatus={giftingScenario.filing}
          />
        </div>
      )}

      {activeTab === 'trusts' && (
        <TrustDocumentsPanel
          embedded
          estateValue={trustWillGuidance.estateValue}
          recommendations={trustWillGuidance.recommendations}
          checklist={trustWillGuidance.checklist}
          initialTrusts={trustWillGuidance.trusts}
          trustEstateSummary={trustEstateSummary}
          marginalStateEstateRatePct={marginalStateEstateRatePct}
        />
      )}
    </div>
  )
}
