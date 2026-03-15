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
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export default function AdvisorClientPage({
  advisorClients,
  netWorthMap,
  advisorId,
}: Props) {
  const [clients, setClients] = useState(advisorClients)
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'clients' | 'invite'>('clients')

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setIsInviting(true)
    setInviteError(null)
    setInviteMessage(null)

    try {
      const response = await fetch('/api/advisor/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail: inviteEmail.trim() }),
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
    await supabase
      .from('advisor_clients')
      .update({ client_status: newStatus })
      .eq('id', clientRecordId)

    setClients(prev =>
      prev.map(c => c.id === clientRecordId ? { ...c, client_status: newStatus } : c)
    )
  }

  const acceptedClients = clients.filter(c => c.accepted_at)
  const pendingClients = clients.filter(c => !c.accepted_at)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Advisor Portal</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {acceptedClients.length} active client{acceptedClients.length !== 1 ? 's' : ''}
            {pendingClients.length > 0 ? ` · ${pendingClients.length} pending` : ''}
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
          ) : (
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
                  {clients.map((c) => {
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
                            <span className="text-sm text-neutral-400 italic">Awaiting signup</span>
                          ) : (
                            <a
                              href={`/advisor/clients/${c.client_id}`}
                              className="text-sm text-indigo-600 hover:underline font-medium"
                            >
                              View →
                            </a>
                          )}
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
    </div>
  )
}
