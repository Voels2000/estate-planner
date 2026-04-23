'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import ConsumerStrategyPanel from '@/components/consumer/ConsumerStrategyPanel'
import { createClient } from '@/lib/supabase/client'

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
  initialTab: string
}

type TrustDocumentRow = {
  id: string
  name: string | null
  trust_type: string | null
  is_irrevocable: boolean | null
  funding_amount: number | null
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
  const [trustDocs, setTrustDocs] = useState<TrustDocumentRow[]>([])
  const [trustDocsLoading, setTrustDocsLoading] = useState(false)
  const [trustDocsError, setTrustDocsError] = useState<string | null>(null)
  const [deletingTrustId, setDeletingTrustId] = useState<string | null>(null)

  async function loadTrustDocuments() {
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
  }

  useEffect(() => {
    void loadTrustDocuments()
  }, [activeTab])

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

  return (
    <div className="space-y-6">
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
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
