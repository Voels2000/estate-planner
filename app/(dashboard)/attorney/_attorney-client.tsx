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

  const incomingRequests = clients.filter(c => c.status === 'consumer_requested')
  const acceptedClients = clients.filter(c => c.status === 'accepted')
  const pendingClients = clients.filter(c => c.status === 'pending')
  const listedClients = clients.filter(c => c.status !== 'consumer_requested')

  // Placeholders — accept/decline routes built in Sprint 29B
  async function handleAcceptRequest(attorneyClientId: string) {
    setLoading(`${attorneyClientId}-accept`)
    // TODO Sprint 29B: POST /api/attorney/accept-request
    setLoading(null)
  }

  async function handleDeclineRequest(attorneyClientId: string) {
    if (!confirm('Decline this connection request?')) return
    setLoading(`${attorneyClientId}-decline`)
    // TODO Sprint 29B: POST /api/attorney/decline-request
    setLoading(null)
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
      </div>

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
          <p className="mt-1 text-xs text-neutral-400">
            Clients will appear here once they connect with you.
          </p>
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
  )
}
