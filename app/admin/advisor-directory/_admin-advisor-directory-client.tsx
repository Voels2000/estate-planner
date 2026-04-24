'use client'

import { useState } from 'react'
import Link from 'next/link'

type Advisor = {
  id: string
  firm_name: string
  contact_name: string | null
  email: string
  city: string | null
  state: string | null
  fee_structure: string | null
  is_fiduciary: boolean
  is_verified: boolean
  is_active: boolean
  created_at: string
  specializations: string[]
  credentials: string[]
}

type Props = { advisors: Advisor[] }

export function AdminAdvisorDirectoryClient({ advisors: initial }: Props) {
  const [advisors, setAdvisors] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleApprove(id: string) {
    setApproving(`${id}-approve`)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/advisor-directory/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: id, action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Approval failed.')
        return
      }
      setAdvisors(prev =>
        prev.map(a => a.id === id ? { ...a, is_active: true, is_verified: true } : a)
      )
      setSuccess('Listing approved and advisor notified.')
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
      const res = await fetch('/api/advisor-directory/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: id, action: 'reject' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Rejection failed.')
        return
      }
      setAdvisors(prev => prev.filter(a => a.id !== id))
      setSuccess('Listing rejected and advisor notified.')
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
      const res = await fetch('/api/advisor-directory/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value }),
      })
      if (!res.ok) { setError('Update failed'); return }
      setAdvisors(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  async function deleteAdvisor(id: string) {
    if (!confirm('Are you sure you want to delete this listing?')) return
    setLoading(`${id}-delete`)
    setError(null)
    try {
      const res = await fetch('/api/advisor-directory/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { setError('Delete failed'); return }
      setAdvisors(prev => prev.filter(a => a.id !== id))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  const pending = advisors.filter(a => !a.is_active && !a.is_verified)
  const active = advisors.filter(a => a.is_active || a.is_verified)

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Advisor Directory</h1>
          <p className="mt-1 text-neutral-500">{advisors.length} listings</p>
        </div>
        <Link
          href="/advisor-directory"
          className="text-sm text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline"
        >
          View public directory
        </Link>
      </div>

      {/* ── Pending Nominations ───────────────────────────── */}
      {pending.length > 0 && (
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
                  {a.specializations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.specializations.map(s => (
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
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ── Active listings table ─────────────────────────── */}
      <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Firm</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Location</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Specializations</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Fiduciary</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Verified</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Active</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {active.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-400">
                  No active listings yet.
                </td>
              </tr>
            )}
            {active.map(advisor => (
              <tr key={advisor.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{advisor.firm_name}</p>
                  <p className="text-neutral-500">{advisor.email}</p>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {[advisor.city, advisor.state].filter(Boolean).join(', ')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {advisor.specializations.slice(0, 2).map(s => (
                      <span key={s} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                        {s}
                      </span>
                    ))}
                    {advisor.specializations.length > 2 && (
                      <span className="text-xs text-neutral-400">+{advisor.specializations.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {advisor.is_fiduciary ? '✓' : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleField(advisor.id, 'is_verified', !advisor.is_verified)}
                    disabled={loading === `${advisor.id}-is_verified`}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      advisor.is_verified
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {advisor.is_verified ? 'Verified' : 'Unverified'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleField(advisor.id, 'is_active', !advisor.is_active)}
                    disabled={loading === `${advisor.id}-is_active`}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      advisor.is_active
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {advisor.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => deleteAdvisor(advisor.id)}
                    disabled={loading === `${advisor.id}-delete`}
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
    </div>
  )
}
