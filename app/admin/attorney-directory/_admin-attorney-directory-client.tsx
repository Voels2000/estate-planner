'use client'

import { useState } from 'react'

type Attorney = {
  id: string
  firm_name: string
  contact_name: string | null
  email: string
  city: string | null
  state: string | null
  fee_structure: string | null
  is_verified: boolean
  is_active: boolean
  created_at: string
  specializations: string[] | null
  credentials: string[] | null
  submitted_by: string | null
}

type ConsumerProfile = { id: string; email: string | null; full_name: string | null }
type AttorneyBrief = { id: string; firm_name: string; email: string }

type AttorneyReferralRow = {
  id: string
  status: string
  trigger_reason: string | null
  notes: string | null
  created_at: string
  status_updated_at: string | null
  requested_by: string
  attorney_id: string | null
  advisor_id: string | null
  consumer: ConsumerProfile | ConsumerProfile[] | null
  attorney: AttorneyBrief | AttorneyBrief[] | null
}

const STATUS_OPTIONS = ['pending', 'contacted', 'converted', 'closed'] as const
type ReferralStatus = (typeof STATUS_OPTIONS)[number]

const STATUS_STYLES: Record<ReferralStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  contacted: 'bg-blue-100 text-blue-700',
  converted: 'bg-green-100 text-green-700',
  closed: 'bg-neutral-100 text-neutral-500',
}

function embedOne<T extends { id: string }>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  return Array.isArray(x) ? x[0] ?? null : x
}

type Props = { attorneys: Attorney[]; referrals: AttorneyReferralRow[] }

export function AdminAttorneyDirectoryClient({ attorneys: initialAttorneys, referrals: initialReferrals }: Props) {
  const [attorneys, setAttorneys] = useState(initialAttorneys)
  const [referrals, setReferrals] = useState(initialReferrals)
  const [loading, setLoading] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [edits, setEdits] = useState<Record<string, { status: string; notes: string }>>(() =>
    Object.fromEntries(initialReferrals.map(r => [r.id, { status: r.status, notes: r.notes ?? '' }])),
  )

  async function handleApprove(id: string) {
    setApproving(`${id}-approve`)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/attorney-directory/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: id, action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Approval failed.')
        return
      }
      setAttorneys(prev =>
        prev.map(a => (a.id === id ? { ...a, is_active: true, is_verified: true } : a)),
      )
      setSuccess(`Listing approved and attorney notified.`)
    } catch {
      setError('Something went wrong.')
    } finally {
      setApproving(null)
    }
  }

  async function handleReject(id: string, firmName: string) {
    if (!confirm(`Reject and permanently delete the listing for "${firmName}"?`)) return
    setApproving(`${id}-reject`)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/attorney-directory/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: id, action: 'reject' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Rejection failed.')
        return
      }
      setAttorneys(prev => prev.filter(a => a.id !== id))
      setSuccess(`Listing rejected and attorney notified.`)
    } catch {
      setError('Something went wrong.')
    } finally {
      setApproving(null)
    }
  }

  async function toggleField(id: string, field: 'is_verified' | 'is_active', value: boolean) {
    setLoading(`${id}-${field}`)
    setError(null)
    try {
      const res = await fetch('/api/attorney-directory/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value }),
      })
      if (!res.ok) {
        setError('Update failed')
        return
      }
      setAttorneys(prev => prev.map(a => (a.id === id ? { ...a, [field]: value } : a)))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  async function deleteAttorney(id: string) {
    if (!confirm('Are you sure you want to delete this listing?')) return
    setLoading(`${id}-delete`)
    setError(null)
    try {
      const res = await fetch('/api/attorney-directory/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        setError('Delete failed')
        return
      }
      setAttorneys(prev => prev.filter(a => a.id !== id))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  async function saveReferralStatus(referralId: string) {
    const edit = edits[referralId]
    if (!edit) return
    setLoading(`${referralId}-status`)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/referrals/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_id: referralId,
          status: edit.status,
          notes: edit.notes || null,
        }),
      })
      if (!res.ok) {
        setError('Failed to update referral status')
        return
      }
      const now = new Date().toISOString()
      setReferrals(prev =>
        prev.map(r =>
          r.id === referralId
            ? { ...r, status: edit.status, notes: edit.notes || null, status_updated_at: now }
            : r,
        ),
      )
      setSuccess('Referral status updated and notifications sent.')
      setTimeout(() => setSuccess(null), 4000)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Attorney Directory</h1>
          <p className="mt-1 text-neutral-500">{attorneys.length} listings</p>
        </div>
        <a
          href="/attorney-directory"
          className="text-sm text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline"
        >
          View public directory
        </a>
      </div>

      {/* ── Pending Nominations ───────────────────────────── */}
      {(() => {
        const pending = attorneys.filter(a => !a.is_active && !a.is_verified)
        if (pending.length === 0) return null
        return (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                ⏳ Pending Nominations
              </h2>
              <p className="mt-1 text-neutral-500">
                {pending.length} nomination{pending.length !== 1 ? 's' : ''} awaiting review
              </p>
            </div>

            <div className="space-y-3">
              {pending.map(a => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-white p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-neutral-900">{a.firm_name}</p>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pending Review
                      </span>
                    </div>
                    {a.contact_name && (
                      <p className="mt-0.5 text-sm text-neutral-500">{a.contact_name}</p>
                    )}
                    <p className="text-sm text-neutral-500">{a.email}</p>
                    {(a.city || a.state) && (
                      <p className="mt-1 text-xs text-neutral-400">
                        📍 {[a.city, a.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {(a.specializations ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(a.specializations ?? []).map(s => (
                          <span
                            key={s}
                            className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-neutral-400">
                      Nominated {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(a.id)}
                      disabled={approving === `${a.id}-approve`}
                      className="whitespace-nowrap rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {approving === `${a.id}-approve` ? 'Approving...' : '✅ Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(a.id, a.firm_name)}
                      disabled={approving === `${a.id}-reject`}
                      className="whitespace-nowrap rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {approving === `${a.id}-reject` ? 'Rejecting...' : '🚫 Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Firm</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Location</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Specializations</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Verified</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Active</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {attorneys
              .filter(a => a.is_active || a.is_verified)
              .map(attorney => (
              <tr key={attorney.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{attorney.firm_name}</p>
                  <p className="text-neutral-500">{attorney.email}</p>
                </td>
                <td className="px-4 py-3 text-neutral-600">{[attorney.city, attorney.state].filter(Boolean).join(', ')}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(attorney.specializations ?? []).slice(0, 2).map(s => (
                      <span key={s} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                        {s}
                      </span>
                    ))}
                    {(attorney.specializations ?? []).length > 2 && (
                      <span className="text-xs text-neutral-400">+{(attorney.specializations ?? []).length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleField(attorney.id, 'is_verified', !attorney.is_verified)}
                    disabled={loading === `${attorney.id}-is_verified`}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      attorney.is_verified
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {attorney.is_verified ? 'Verified' : 'Unverified'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleField(attorney.id, 'is_active', !attorney.is_active)}
                    disabled={loading === `${attorney.id}-is_active`}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      attorney.is_active
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {attorney.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => deleteAttorney(attorney.id)}
                    disabled={loading === `${attorney.id}-delete`}
                    className="text-xs text-red-500 hover:text-red-700 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-12">
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight text-neutral-900">Attorney Referrals</h2>
          <p className="mt-1 text-neutral-500">{referrals.length} referrals</p>
        </div>

        <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Consumer</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Attorney</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Submitted</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Notes</th>
                <th className="px-4 py-3 text-center font-medium text-neutral-500">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-400">
                    No referrals yet.
                  </td>
                </tr>
              )}
              {referrals.map(r => {
                const consumer = embedOne(r.consumer)
                const att = embedOne(r.attorney)
                const edit = edits[r.id] ?? { status: r.status, notes: r.notes ?? '' }
                const isDirty = edit.status !== r.status || edit.notes !== (r.notes ?? '')
                const statusOptions = Array.from(new Set([...STATUS_OPTIONS, edit.status]))

                return (
                  <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{consumer?.full_name ?? '—'}</p>
                      <p className="text-neutral-500 text-xs">{consumer?.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{att?.firm_name ?? '—'}</p>
                      <p className="text-neutral-500 text-xs">{att?.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 max-w-[140px] truncate">{r.trigger_reason ?? '—'}</td>
                    <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={edit.status}
                        onChange={e =>
                          setEdits(prev => ({ ...prev, [r.id]: { ...edit, status: e.target.value } }))
                        }
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer
                          focus:ring-2 focus:ring-indigo-300 focus:outline-none
                          ${STATUS_STYLES[edit.status as ReferralStatus] ?? 'bg-neutral-100 text-neutral-500'}`}
                      >
                        {statusOptions.map(s => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={edit.notes}
                        onChange={e =>
                          setEdits(prev => ({ ...prev, [r.id]: { ...edit, notes: e.target.value } }))
                        }
                        placeholder="Optional note…"
                        className="w-full rounded-lg border border-neutral-200 px-2 py-1 text-xs
                          text-neutral-700 placeholder-neutral-300 focus:outline-none
                          focus:ring-2 focus:ring-indigo-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => void saveReferralStatus(r.id)}
                        disabled={!isDirty || loading === `${r.id}-status`}
                        className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                          isDirty
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                        }`}
                      >
                        {loading === `${r.id}-status` ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
