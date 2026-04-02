'use client'

import { useState } from 'react'

type AttorneyClient = {
  id: string
  status: string
  created_at: string
  client_id: string | null
  request_message: string | null
  profiles: {
    id: string
    full_name: string
    email: string
    subscription_status: string
    created_at: string
  } | null
}

type Props = {
  attorneyClients: AttorneyClient[]
  attorneyId: string
}

function formatDate(d: string) {
  const date = new Date(d)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

export default function AttorneyClientPage({
  attorneyClients,
  attorneyId,
}: Props) {
  const [clients, setClients] = useState(attorneyClients)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'clients' | 'invite'>('clients')
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const incomingRequests = clients.filter(c => c.status === 'consumer_requested')
  const acceptedClients = clients.filter(c => c.status === 'accepted')
  const pendingClients = clients.filter(c => c.status === 'pending')
  const listedClients = clients.filter(c => c.status !== 'consumer_requested')

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setIsInviting(true)
    setInviteError(null)
    setInviteMessage(null)
    try {
      const res = await fetch('/api/attorney/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitedEmail: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error ?? 'Something went wrong.')
        return
      }
      setInviteMessage(data.message)
      setInviteEmail('')
      setTimeout(() => window.location.reload(), 2000)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsInviting(false)
    }
  }

  async function handleAcceptRequest(attorneyClientId: string) {
    setLoading(`${attorneyClientId}-accept`)
    setError(null)
    try {
      const res = await fetch('/api/attorney/accept-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attorney_client_id: attorneyClientId }),
      })
      if (!res.ok) {
        setError('Failed to accept request')
        return
      }
      setClients(prev =>
        prev.map(c => c.id === attorneyClientId ? { ...c, status: 'pending' } : c)
      )
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  async function handleDeclineRequest(attorneyClientId: string) {
    if (!confirm('Decline this connection request?')) return
    setLoading(`${attorneyClientId}-decline`)
    setError(null)
    try {
      const res = await fetch('/api/attorney/decline-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attorney_client_id: attorneyClientId }),
      })
      if (!res.ok) {
        setError('Failed to decline request')
        return
      }
      setClients(prev => prev.filter(c => c.id !== attorneyClientId))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Attorney Portal</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {acceptedClients.length} active client{acceptedClients.length !== 1 ? 's' : ''}
            {pendingClients.length > 0 ? ` · ${pendingClients.length} pending` : ''}
            {incomingRequests.length > 0 ? ` · ${incomingRequests.length} incoming request${incomingRequests.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <button
          onClick={() => setActiveTab('invite')}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
        >
          + Add Client
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(['clients', 'invite'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-neutral-900 text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab === 'clients' ? 'My Clients' : 'Add Client'}
          </button>
        ))}
      </div>

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-amber-800">
                Incoming Requests ({incomingRequests.length})
              </h2>
              {incomingRequests.map(c => {
                const displayName = c.profiles?.full_name ?? '—'
                const displayEmail = c.profiles?.email ?? '—'
                return (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-4 rounded-xl bg-white border border-amber-100 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{displayName}</p>
                      <p className="text-xs text-neutral-500">{displayEmail}</p>
                      {c.request_message && (
                        <p className="mt-1 text-xs text-neutral-600 italic">"{c.request_message}"</p>
                      )}
                      <p className="mt-1 text-xs text-neutral-400">
                        Requested {formatDate(c.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAcceptRequest(c.id)}
                        disabled={!!loading}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                      >
                        {loading === `${c.id}-accept` ? 'Accepting...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(c.id)}
                        disabled={!!loading}
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition"
                      >
                        {loading === `${c.id}-decline` ? 'Declining...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Clients Table */}
          {listedClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
              <div className="text-4xl mb-3">⚖️</div>
              <p className="text-sm font-medium text-neutral-600">No clients yet</p>
              <button
                onClick={() => setActiveTab('invite')}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                Add your first client →
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Member Since</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {listedClients.map(c => {
                    const displayName = c.profiles?.full_name ?? '—'
                    const displayEmail = c.profiles?.email ?? '—'
                    const isPending = c.status === 'pending'
                    return (
                      <tr key={c.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-neutral-900">{displayName}</p>
                          <p className="text-xs text-neutral-400">{displayEmail}</p>
                          {isPending && (
                            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Invite sent
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-neutral-500">
                          {c.profiles?.created_at ? formatDate(c.profiles.created_at) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isPending
                              ? 'bg-neutral-100 text-neutral-500'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isPending ? 'Pending' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Tab */}
      {activeTab === 'invite' && (
        <div className="max-w-md">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
              Add a Client by Email
            </h2>
            <p className="text-sm text-neutral-600 mb-4">
              Enter your client's email address. They'll receive an invitation to connect with your practice on Wealth Maps.
            </p>
            <div className="space-y-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder="client@example.com"
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              />
              <button
                onClick={handleInvite}
                disabled={isInviting || !inviteEmail.trim()}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {isInviting ? 'Adding...' : 'Add Client'}
              </button>
            </div>
            {inviteMessage && (
              <p className="mt-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                ✓ {inviteMessage}
              </p>
            )}
            {inviteError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {inviteError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
