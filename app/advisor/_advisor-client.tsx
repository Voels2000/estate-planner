'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AdvisorClient = {
  id: string
  status: string
  client_status: string
  invited_at: string
  accepted_at: string | null
  client_id: string | null
  invited_email: string | null
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
  advisorClients: AdvisorClient[]
  netWorthMap: Record<string, number>
  advisorId: string
  isFirmOwner?: boolean
  firm_name?: string | null
  firm_id?: string | null
}

const STATUS_OPTIONS = ['active', 'needs_review', 'at_risk', 'inactive']
const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  needs_review: 'Needs Review',
  at_risk: 'At Risk',
  inactive: 'Inactive',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  needs_review: 'bg-amber-100 text-amber-700',
  at_risk: 'bg-red-100 text-red-700',
  inactive: 'bg-neutral-100 text-neutral-500',
}

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function formatDate(d: string) {
  const date = new Date(d)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

export default function AdvisorClientPage({
  advisorClients,
  netWorthMap,
  advisorId,
  isFirmOwner,
  firm_name,
  firm_id,
}: Props) {
  const [clients, setClients] = useState(advisorClients)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  type ActiveTab = 'clients' | 'invite' | 'find-attorney' | 'list-practice' | 'export'

  const [activeTab, setActiveTab] = useState<ActiveTab>('clients')
  const [tierLimitModal, setTierLimitModal] = useState<{
    current_count: number
    max_clients: number
    tier_name: string
  } | null>(null)

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setIsInviting(true)
    setInviteError(null)
    setInviteMessage(null)

    try {
      const response = await fetch('/api/advisor/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitedEmail: inviteEmail.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
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

  async function handleStatusChange(clientRecordId: string, clientId: string | null, newStatus: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('advisor_clients')
      .update({ client_status: newStatus })
      .eq('id', clientRecordId)

    if (error) {
      console.error('Status update failed', error)
      setError('Failed to update client status. Please refresh and try again.')
      return
    }

    setClients(prev =>
      prev.map(c => c.id === clientRecordId ? { ...c, client_status: newStatus } : c)
    )
  }

  async function handleRemoveClient(advisorClientId: string) {
    if (!confirm('Remove this client? If billing was transferred their tier will be reverted.')) return
    setLoading(`${advisorClientId}-remove`)
    setError(null)
    try {
      const res = await fetch('/api/advisor/remove-client', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor_client_id: advisorClientId }),
      })
      if (!res.ok) {
        setError('Failed to remove client')
        return
      }
      setClients(prev => prev.filter(c => c.id !== advisorClientId))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  async function handleAcceptRequest(advisorClientId: string) {
    setLoading(`${advisorClientId}-accept`)
    setError(null)
    try {
      const res = await fetch('/api/advisor/accept-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor_client_id: advisorClientId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.error === 'tier_limit_reached') {
          setTierLimitModal({
            current_count: data.current_count,
            max_clients: data.max_clients,
            tier_name: data.tier_name,
          })
          return
        }
        setError(data.error ?? 'Failed to accept request')
        return
      }

      // Move from incoming to pending (invite sent, awaiting acceptance)
      setClients(prev =>
        prev.map(c => c.id === advisorClientId ? { ...c, status: 'pending' } : c)
      )
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  async function handleDeclineRequest(advisorClientId: string) {
    if (!confirm('Decline this connection request?')) return
    setLoading(`${advisorClientId}-decline`)
    setError(null)
    try {
      const res = await fetch('/api/advisor/decline-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor_client_id: advisorClientId }),
      })
      if (!res.ok) {
        setError('Failed to decline request')
        return
      }
      setClients(prev => prev.filter(c => c.id !== advisorClientId))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  const incomingRequests = clients.filter(c => c.status === 'consumer_requested')
  const acceptedClients = clients.filter(c => c.accepted_at && c.status !== 'consumer_requested')
  const pendingClients = clients.filter(c => !c.accepted_at && c.status !== 'consumer_requested')
  const listedClients = clients.filter(c => c.status !== 'consumer_requested')

  const showFirmBanner = firm_id != null && firm_id !== ''

  const tabClass = (id: ActiveTab) =>
    `px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
      activeTab === id
        ? 'border-b-2 border-neutral-900 text-neutral-900'
        : 'text-neutral-500 hover:text-neutral-700'
    }`

  return (
    <div className="space-y-8">
      {/* Tier limit upgrade modal */}
      {tierLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-1 text-2xl">🔒</div>
            <h2 className="text-lg font-bold text-neutral-900">Client Limit Reached</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Your <span className="font-medium">{tierLimitModal.tier_name}</span> plan
              allows up to <span className="font-medium">{tierLimitModal.max_clients} clients</span>.
              You currently have <span className="font-medium">{tierLimitModal.current_count}</span>.
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Upgrade your plan to accept more clients.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href="/billing"
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-neutral-800 transition"
              >
                View Upgrade Options →
              </a>
              <button
                onClick={() => setTierLimitModal(null)}
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Advisor Portal</h1>
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

      {showFirmBanner && isFirmOwner === true && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          🏢 {firm_name ?? 'Firm'} · Firm Owner · Manage your firm in{' '}
          <a href="/advisor/firm" className="font-medium text-indigo-700 underline hover:text-indigo-900">
            Firm Settings ⚙️
          </a>
        </div>
      )}
      {showFirmBanner && isFirmOwner === false && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          🏢 You are a member of a firm. Contact your firm owner for billing and settings.
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto">
        {[
          { id: 'clients' as const, label: 'My Clients', icon: '👥' },
          { id: 'invite' as const, label: 'Add Client', icon: '✉️' },
          { id: 'find-attorney' as const, label: 'Find an Attorney', icon: '⚖️' },
          { id: 'list-practice' as const, label: 'List Your Practice', icon: '📋' },
          { id: 'export' as const, label: 'Export Estate Plan', icon: '📄' },
        ].map(({ id, label, icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={tabClass(id)}>
            <span suppressHydrationWarning>{icon}</span>
            {' '}{label}
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
                const displayName = c.profiles?.full_name ?? c.invited_email ?? 'Unknown'
                const displayEmail = c.profiles?.email ?? c.invited_email ?? '—'
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
                        Requested {formatDate(c.invited_at)}
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
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-sm font-medium text-neutral-600">No clients yet</p>
              <button
                onClick={() => setActiveTab('invite')}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                Add your first client →
              </button>
            </div>
          ) : listedClients.length > 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Net Worth</th>
                    <th className="px-6 py-3">Member Since</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {listedClients.map((c) => {
                    const isPending = !c.accepted_at
                    const displayName = c.profiles?.full_name ?? c.invited_email ?? 'Unknown'
                    const displayEmail = c.profiles?.email ?? c.invited_email ?? '—'

                    return (
                      <tr key={c.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-neutral-900">{displayName}</p>
                          <p className="text-xs text-neutral-400">{displayEmail}</p>
                          {isPending && (
                            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Pending signup
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-neutral-900">
                          {isPending ? '—' : formatDollars(netWorthMap[c.client_id ?? ''] ?? 0)}
                        </td>
                        <td className="px-6 py-4 text-neutral-500">
                          {c.profiles?.created_at ? formatDate(c.profiles.created_at) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          {isPending ? (
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS['inactive']}`}>
                              Invited
                            </span>
                          ) : (
                            <select
                              value={c.client_status ?? 'active'}
                              onChange={(e) => handleStatusChange(c.id, c.client_id ?? '', e.target.value)}
                              className={`rounded-full px-3 py-1 text-xs font-medium border-0 cursor-pointer ${
                                STATUS_COLORS[c.client_status ?? 'active']
                              }`}
                            >
                              {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isPending ? (
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-neutral-400 italic">Awaiting signup</span>
                              <button
                                type="button"
                                onClick={() => void handleRemoveClient(c.id)}
                                disabled={loading === `${c.id}-remove`}
                                className="text-xs text-red-500 hover:text-red-700 transition disabled:opacity-50"
                              >
                                {loading === `${c.id}-remove` ? 'Removing…' : 'Delete'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <a
                                href={`/advisor/clients/${c.client_id}`}
                                className="text-sm font-medium text-indigo-600 hover:underline"
                              >
                                View →
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRemoveClient(c.id)}
                                disabled={loading === `${c.id}-remove`}
                                className="text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {loading === `${c.id}-remove` ? 'Removing...' : 'Remove'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
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
              Enter your client's email address. If they already have an account they'll be linked instantly. If not, they'll be linked automatically when they sign up.
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

      {/* Find an Attorney tab */}
      {activeTab === 'find-attorney' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Find an Attorney</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Browse estate attorneys in our directory to refer clients or collaborate on cases.
              </p>
            </div>
            <a
              href="/attorney-directory"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
            >
              ⚖️ Open Attorney Directory →
            </a>
          </div>
        </div>
      )}

      {/* List Your Practice tab */}
      {activeTab === 'list-practice' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">List Your Practice</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Add or update your practice listing in the advisor directory so clients can find and connect with you.
              </p>
            </div>
            <a
              href="/list-your-practice"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
            >
              📋 Manage Your Listing →
            </a>
          </div>
        </div>
      )}

      {/* Export Estate Plan tab */}
      {activeTab === 'export' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Export Estate Plan</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Generate a PDF or printable summary of your estate plan to share with clients or attorneys.
              </p>
            </div>
            <a
              href="/print"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
            >
              📄 Open Export →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
