'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import ConsumerStrategyPanel from '@/components/consumer/ConsumerStrategyPanel'

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
  userRole: 'consumer' | 'advisor'
  consumerTier: number
  initialTab: string
}

export default function MyEstateTrustStrategyClient({
  householdId,
  userRole,
  consumerTier,
  initialTab,
}: Props) {
  const validTabs: Tab[] = ['gifting', 'charitable', 'strategies', 'trusts']
  const startTab = validTabs.includes(initialTab as Tab) ? (initialTab as Tab) : 'gifting'
  const [activeTab, setActiveTab] = useState<Tab>(startTab)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Estate & Trust Strategy</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track gifting, charitable giving, and estate transfer strategies in one place.
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
        <GiftingDashboard householdId={householdId} userRole={userRole} consumerTier={consumerTier} />
      )}

      {activeTab === 'charitable' && (
        <CharitableGivingDashboard
          householdId={householdId}
          userRole={userRole}
          consumerTier={consumerTier}
        />
      )}

      {activeTab === 'strategies' && <ConsumerStrategyPanel householdId={householdId} userRole={userRole} />}

      {activeTab === 'trusts' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-800">Trusts & Estate Documents</h2>
            <p className="mb-4 text-sm text-gray-500">
              Trust planning and document management are coming soon. Your estate documents (will,
              power of attorney, advance directive) can be tracked in the meantime.
            </p>
            <a
              href="/trust-will"
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              📋 Go to Trust & Will Guidance →
            </a>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> Trust formation, funding, and
              administration require an attorney. This tool provides information only - not legal
              advice. Use the <a href="/my-advisor" className="underline">My Advisor</a> or{' '}
              <a href="/settings/attorney-access" className="underline">
                My Attorney
              </a>{' '}
              pages to connect with a professional.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
