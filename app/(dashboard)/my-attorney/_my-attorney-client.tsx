'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'

type Connection = {
  connection_id: string
  attorney_id: string
  status: string
  granted_at: string | null
  advisor_pdf_access: boolean
  firm_name: string | null
  contact_name: string | null
  email: string | null
  city: string | null
  state: string | null
  bio: string | null
  specializations: string[]
  website: string | null
}

type PendingRequest = {
  id: string
  created_at: string
  listing_id: string
  firm_name: string | null
  city: string | null
  state: string | null
}

type Props = {
  connections: Connection[]
  pendingRequests: PendingRequest[]
}

export default function MyAttorneyClient({ connections, pendingRequests }: Props) {
  const [revoking, setRevoking] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelledIds, setCancelledIds] = useState<string[]>([])
  const [activeConnections, setActiveConnections] = useState(connections)
  const [error, setError] = useState<string | null>(null)

  async function handleRevoke(connectionId: string, name: string) {
    if (!confirm(`Revoke access for ${name}? They will no longer be able to view your estate plan.`)) return
    setRevoking(connectionId)
    setError(null)
    try {
      const res = await fetch('/api/attorney/revoke-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to revoke access.')
      } else {
        setActiveConnections(prev => prev.filter(c => c.connection_id !== connectionId))
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setRevoking(null)
    }
  }

  async function handleCancel(requestId: string) {
    if (!window.confirm('Cancel your connection request?')) return
    setCancellingId(requestId)
    setError(null)
    try {
      const res = await fetch('/api/connection-requests/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      })
      if (res.ok) {
        setCancelledIds(prev => [...prev, requestId])
      } else {
        const d = await res.json()
        setError(d.error ?? 'Failed to cancel request.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  const activePending = pendingRequests.filter(r => !cancelledIds.includes(r.id))
  const hasAny = activeConnections.length > 0 || activePending.length > 0

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My Attorney</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your estate planning attorney connections
        </p>
        <p className="mt-2 text-xs text-neutral-400">{DISCLAIMER_STRINGS.attorneyRelationship}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Pending requests */}
      {activePending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            Pending Requests
          </h2>
          <div className="space-y-3">
            {activePending.map(req => (
              <div key={req.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <div style={{ fontSize: 24, flexShrink: 0 }}>⏳</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-amber-800">
                      Request Pending
                    </div>
                    <div className="text-sm text-amber-700 mt-0.5">
                      {req.firm_name
                        ? <>Your request to <strong>{req.firm_name}</strong>
                          {(req.city || req.state) && (
                            <> ({[req.city, req.state].filter(Boolean).join(', ')})</>
                          )} is awaiting their response.</>
                        : 'Your connection request is awaiting a response.'}
                    </div>
                    <div className="text-xs text-amber-600 mt-1">
                      Sent {new Date(req.created_at).toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric'
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={cancellingId === req.id}
                    className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap self-start"
                  >
                    {cancellingId === req.id ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active connections */}
      {activeConnections.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            Connected Attorneys
          </h2>
          <div className="space-y-4">
            {activeConnections.map(conn => (
              <div key={conn.connection_id}
                className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-neutral-900">
                        {conn.firm_name ?? conn.contact_name ?? 'Your Attorney'}
                      </h2>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Connected
                      </span>
                    </div>
                    {conn.contact_name && conn.firm_name && (
                      <p className="text-sm text-neutral-500 mt-0.5">{conn.contact_name}</p>
                    )}
                    {(conn.city || conn.state) && (
                      <p className="text-sm text-neutral-400 mt-0.5">
                        {[conn.city, conn.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {conn.email && (
                      <p className="text-sm text-neutral-400">{conn.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRevoke(conn.connection_id, conn.firm_name ?? conn.contact_name ?? 'this attorney')}
                    disabled={revoking === conn.connection_id}
                    className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    {revoking === conn.connection_id ? 'Revoking...' : 'Revoke Access'}
                  </button>
                </div>
                {conn.bio && (
                  <p className="mt-3 text-sm text-neutral-600 leading-relaxed">{conn.bio}</p>
                )}
                {conn.specializations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conn.specializations.map(s => (
                      <span key={s}
                        className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
                  {conn.granted_at && (
                    <div className="text-xs text-neutral-400">
                      Connected since {new Date(conn.granted_at).toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric'
                      })}
                    </div>
                  )}
                  {conn.website && (
                    <a href={conn.website} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline">
                      Visit website
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasAny && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">⚖️</div>
          <p className="text-sm font-medium text-neutral-600">No attorney connected</p>
          <p className="mt-1 text-sm text-neutral-400 max-w-xs">
            Find a verified estate planning attorney to help draft your wills, trusts, and legal documents.
          </p>
          <Link href="/find-attorney"
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition">
            Find an Attorney
          </Link>
        </div>
      )}

      {/* Find more */}
      {hasAny && (
        <div className="text-center pt-2">
          <Link href="/find-attorney"
            className="text-sm text-neutral-500 hover:text-neutral-700 underline underline-offset-4">
            Browse attorney directory →
          </Link>
        </div>
      )}
    </div>
  )
}
