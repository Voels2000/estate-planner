'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import ConsumerStrategyPanel from '@/components/consumer/ConsumerStrategyPanel'
import type { EstateContext } from '@/components/consumer/ConsumerStrategyPanel'
import StrategyHorizonTable, { type PendingAdvisorItem } from '@/components/shared/StrategyHorizonTable'
import { createClient } from '@/lib/supabase/client'
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

const TRUST_DOCUMENT_TYPES = [
  'Revocable',
  'Irrevocable',
  'QTIP',
  'Bypass',
  'Charitable',
  'Special needs',
] as const

interface Props {
  householdId: string
  userRole: 'consumer' | 'advisor'
  consumerTier: number
  estateContext?: EstateContext
  initialTab: string
  advisorRecommendations: { strategy_type: string; label: string | null }[]
  advisorLineItems: AdvisorLineItem[]
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
}

type TrustDocumentRow = {
  id: string
  name: string | null
  trust_type: string | null
  is_irrevocable: boolean | null
  funding_amount: number | null
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
  userRole,
  consumerTier,
  estateContext,
  initialTab,
  advisorRecommendations,
  advisorLineItems,
  advisorHorizons,
  strategyImpact,
  giftingScenario,
  initialGiftingSummary,
}: Props) {
  const validTabs: Tab[] = ['gifting', 'charitable', 'strategies', 'trusts']
  const startTab = validTabs.includes(initialTab as Tab) ? (initialTab as Tab) : 'gifting'
  const [activeTab, setActiveTab] = useState<Tab>(startTab)
  const [trustDocs, setTrustDocs] = useState<TrustDocumentRow[]>([])
  const [trustDocsLoading, setTrustDocsLoading] = useState(false)
  const [trustDocsError, setTrustDocsError] = useState<string | null>(null)
  const [deletingTrustId, setDeletingTrustId] = useState<string | null>(null)
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

  const loadTrustDocuments = useCallback(async () => {
    if (activeTab !== 'trusts') return
    setTrustDocsLoading(true)
    setTrustDocsError(null)
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      setTrustDocs([])
      setTrustDocsLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('trusts')
      .select('id, name, trust_type, is_irrevocable, funding_amount')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      setTrustDocsError(error.message)
      setTrustDocs([])
    } else {
      setTrustDocs((data as TrustDocumentRow[]) ?? [])
    }
    setTrustDocsLoading(false)
  }, [activeTab])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTrustDocuments()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadTrustDocuments])

  const trustDocCountLabel = useMemo(() => {
    if (trustDocs.length === 1) return '1 trust document saved'
    return `${trustDocs.length} trust documents saved`
  }, [trustDocs.length])

  async function handleDeleteTrustDocument(id: string) {
    const confirmed = window.confirm('Delete this trust document? This action cannot be undone.')
    if (!confirmed) return
    setDeletingTrustId(id)
    setTrustDocsError(null)
    const supabase = createClient()
    const { error } = await supabase.from('trusts').delete().eq('id', id)
    if (error) {
      setTrustDocsError(error.message)
      setDeletingTrustId(null)
      return
    }
    setTrustDocs((prev) => prev.filter((t) => t.id !== id))
    setDeletingTrustId(null)
  }

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
              onClick={() => setActiveTab(tab.id)}
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
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {activeTab === 'charitable' && (
        <CharitableGivingDashboard
          householdId={householdId}
          userRole={userRole}
          consumerTier={consumerTier}
        />
      )}

      {activeTab === 'strategies' && (
        <div className="space-y-4">
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
            userRole={userRole}
            advisorLineItems={advisorLineItems}
            estateContext={estateContext}
          />
        </div>
      )}

      {activeTab === 'trusts' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-800">Trusts & Estate Documents</h2>
            <a
              href="/trust-will"
              className="mb-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              + Add Trust Document
            </a>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Trust types you can add
              </p>
              <div className="flex flex-wrap gap-2">
                {TRUST_DOCUMENT_TYPES.map((type) => (
                  <span
                    key={type}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-800">Stored Trust Documents</h3>
              <span className="text-xs text-gray-500">{trustDocCountLabel}</span>
            </div>
            {trustDocsLoading ? (
              <p className="text-sm text-gray-500">Loading trust documents...</p>
            ) : trustDocs.length === 0 ? (
              <p className="text-sm text-gray-500">
                No trust documents saved yet. Click <span className="font-medium">Add Trust Document</span> to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {trustDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {doc.name?.trim() || 'Untitled trust document'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(doc.trust_type ?? 'revocable').replace(/_/g, ' ')}
                        {doc.is_irrevocable ? ' • Irrevocable' : ''}
                        {typeof doc.funding_amount === 'number' && doc.funding_amount > 0
                          ? ` • Funding ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(doc.funding_amount)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href="/trust-will"
                        className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTrustDocument(doc.id)}
                        disabled={deletingTrustId === doc.id}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingTrustId === doc.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {trustDocsError && (
              <p className="mt-3 text-xs text-red-600">{trustDocsError}</p>
            )}
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> The advance strategies and trusts on this
              page are complex. We recommend you consult an advisor or attorney.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
