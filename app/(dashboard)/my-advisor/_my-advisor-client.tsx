'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Connection = {
  id: string
  status: string
  accepted_at: string
  advisor_id: string
  profiles: {
    id: string
    full_name: string
    email: string
  } | null
} | null

type Listing = {
  firm_name: string | null
  city: string | null
  state: string | null
  bio: string | null
  credentials: string[]
  specializations: string[]
  is_fiduciary: boolean
  website: string | null
} | null

type AccessEntry = {
  accessed_at: string
  page: string
}

type Props = {
  connection: Connection
  listing: Listing
  accessLog: AccessEntry[]
}

export default function MyAdvisorClient({ connection, listing, accessLog }: Props) {
  const router = useRouter()
  const [isRevoking, setIsRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRevoke() {
    if (!connection) return
    const confirmed = window.confirm(
      'Are you sure you want to disconnect your advisor? They will no longer have access to your plan.'
    )
    if (!confirmed) return

    setIsRevoking(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('advisor_clients')
      .update({ status: 'revoked' })
      .eq('id', connection.id)

    if (err) {
      setError('Failed to disconnect advisor. Please try again.')
      setIsRevoking(false)
      return
    }

    router.refresh()
  }

  if (!connection) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Advisor</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage your advisor connection</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">👤</div>
          <p className="text-sm font-medium text-neutral-600">No advisor connected</p>
          <p className="mt-1 text-sm text-neutral-400">
            Your advisor can send you an invite by email, or you can find one in the directory.
          </p>
          <a
            href="/advisor-directory"
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
          >
            Find an Advisor
          </a>
        </div>
      </div>
    )
  }

  const advisor = connection.profiles
  const connectedDate = new Date(connection.accepted_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My Advisor</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage your advisor connection</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">
                {listing?.firm_name ?? advisor?.full_name ?? 'Your Advisor'}
              </h2>
              {listing?.is_fiduciary && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Fiduciary
                </span>
              )}
            </div>
            {advisor?.full_name && listing?.firm_name && (
              <p className="text-sm text-neutral-500 mt-0.5">{advisor.full_name}</p>
            )}
            {(listing?.city || listing?.state) && (
              <p className="text-sm text-neutral-400 mt-0.5">
                {[listing.city, listing.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            Connected
          </span>
        </div>

        {listing?.bio && (
          <p className="mt-4 text-sm text-neutral-600 leading-relaxed">{listing.bio}</p>
        )}

        {listing?.credentials && listing.credentials.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {listing.credentials.map(c => (
              <span key={c} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Connected since {connectedDate}
            {advisor?.email && (
              <span className="ml-3">{advisor.email}</span>
            )}
          </div>
          {listing?.website && (
            <a
              href={listing.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline"
            >
              Visit website
            </a>
          )}
        </div>
      </div>

      {accessLog.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Recent Advisor Activity
          </h2>
          <div className="space-y-2">
            {accessLog.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Viewed your plan</span>
                <span className="text-neutral-400">
                  {new Date(entry.accessed_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Disconnect Advisor
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Removing your advisor will immediately revoke their access to your financial plan.
          You can reconnect at any time by accepting a new invitation.
        </p>
        {error && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        <button
          onClick={handleRevoke}
          disabled={isRevoking}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
        >
          {isRevoking ? 'Disconnecting...' : 'Disconnect Advisor'}
        </button>
      </div>
    </div>
  )
}
