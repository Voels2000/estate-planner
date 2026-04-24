'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ADVISOR_FIRM_SEAT_RATES } from '@/lib/tiers'
import type { FirmMemberRow } from './page'

type Props = {
  firm_name: string
  firmTier: string | null
  seatCount: number | null
  members: FirmMemberRow[]
  rosterError?: boolean
}

const TIER_LABELS: Record<string, string> = {
  starter: 'Starter (1–10 advisors)',
  growth: 'Growth (11–50 advisors)',
  enterprise: 'Enterprise (51–250 advisors)',
}

function tierLabel(tier: string | null) {
  if (tier && TIER_LABELS[tier]) return TIER_LABELS[tier]
  return TIER_LABELS.starter
}

function perSeatRate(tier: string | null) {
  const key = tier ?? 'starter'
  return ADVISOR_FIRM_SEAT_RATES[key] ?? ADVISOR_FIRM_SEAT_RATES.starter
}

function formatJoined(iso: string | null) {
  if (!iso) return 'Pending'
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export default function FirmClient({
  firm_name,
  firmTier,
  seatCount,
  members: initialMembers,
  rosterError = false,
}: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [localFirmName, setLocalFirmName] = useState(firm_name)
  const [editingFirmName, setEditingFirmName] = useState(false)
  const [draftFirmName, setDraftFirmName] = useState('')
  const [firmNameError, setFirmNameError] = useState<string | null>(null)
  const [firmNameSaveLoading, setFirmNameSaveLoading] = useState(false)
  const [firmNameSuccess, setFirmNameSuccess] = useState<string | null>(null)

  const router = useRouter()
  const [dissolvePhase, setDissolvePhase] = useState<'idle' | 'confirm' | 'success'>('idle')
  const [dissolveLoading, setDissolveLoading] = useState(false)
  const [dissolveError, setDissolveError] = useState<string | null>(null)

  useEffect(() => {
    if (!firmNameSuccess) return
    const t = setTimeout(() => setFirmNameSuccess(null), 3000)
    return () => clearTimeout(t)
  }, [firmNameSuccess])

  const seats = seatCount ?? 0
  const rate = perSeatRate(firmTier)
  const monthly = rate * seats

  async function handleRemove(memberId: string) {
    if (!window.confirm('Remove this advisor from your firm?')) return
    setRemovingId(memberId)
    try {
      const res = await fetch('/api/firm/remove-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        window.alert((data as { error?: string }).error ?? 'Could not remove member.')
        return
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      window.alert('Something went wrong.')
    } finally {
      setRemovingId(null)
    }
  }

  function startEditFirmName() {
    setDraftFirmName(localFirmName)
    setEditingFirmName(true)
    setFirmNameError(null)
    setFirmNameSuccess(null)
  }

  function cancelEditFirmName() {
    setEditingFirmName(false)
    setFirmNameError(null)
  }

  async function saveFirmName() {
    const trimmed = draftFirmName.trim()
    if (!trimmed) {
      setFirmNameError('Firm name cannot be empty.')
      return
    }
    setFirmNameSaveLoading(true)
    setFirmNameError(null)
    try {
      const res = await fetch('/api/firm/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFirmNameError(
          (data as { error?: string }).error ?? 'Failed to update firm name.',
        )
        return
      }
      const newName = (data as { name?: string }).name ?? trimmed
      setLocalFirmName(newName)
      setEditingFirmName(false)
      setFirmNameSuccess('Firm name updated ✅')
    } catch {
      setFirmNameError('Failed to update firm name.')
    } finally {
      setFirmNameSaveLoading(false)
    }
  }

  async function handleSendInvite() {
    const trimmed = inviteEmail.trim()
    if (!trimmed) return
    setInviteLoading(true)
    setInviteSuccess(null)
    setInviteError(null)
    try {
      const res = await fetch('/api/firm/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setInviteError((data as { error?: string }).error ?? 'Invite failed.')
        return
      }
      setInviteSuccess(`Invite sent to ${trimmed} ✅`)
      setInviteEmail('')
      router.refresh()
    } catch {
      setInviteError('Something went wrong.')
    } finally {
      setInviteLoading(false)
    }
  }

  async function confirmDissolveFirm() {
    setDissolveLoading(true)
    setDissolveError(null)
    try {
      const res = await fetch('/api/firm/dissolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDissolveError(
          (data as { error?: string }).error ?? 'Failed to dissolve firm. Please try again.',
        )
        setDissolvePhase('idle')
        return
      }
      setDissolvePhase('success')
      setTimeout(() => {
        router.push('/advisor')
      }, 2000)
    } catch {
      setDissolveError('Failed to dissolve firm. Please try again.')
      setDissolvePhase('idle')
    } finally {
      setDissolveLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <a
          href="/advisor"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Advisor Portal
        </a>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">Firm</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your firm subscription and advisor roster.
        </p>
      </div>

      {/* Section 1 — Firm Summary */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
          Firm summary
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2 items-start">
            <span className="text-neutral-500 shrink-0">Firm name</span>
            <div className="flex flex-col items-end gap-1 min-w-0 max-w-full">
              {!editingFirmName ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="font-medium text-neutral-900 text-right break-words">
                    {localFirmName}
                  </span>
                  <button
                    type="button"
                    onClick={startEditFirmName}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0"
                  >
                    Edit ✏️
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-stretch gap-2 w-full max-w-xs sm:max-w-md">
                  <input
                    type="text"
                    value={draftFirmName}
                    onChange={(e) => setDraftFirmName(e.target.value)}
                    maxLength={80}
                    disabled={firmNameSaveLoading}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-50"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void saveFirmName()}
                      disabled={firmNameSaveLoading}
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
                    >
                      {firmNameSaveLoading ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditFirmName}
                      disabled={firmNameSaveLoading}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {firmNameError && (
                <p className="text-sm text-red-600 text-right max-w-md">{firmNameError}</p>
              )}
              {firmNameSuccess && !editingFirmName && (
                <p className="text-sm text-green-700 text-right">{firmNameSuccess}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-neutral-500">Tier</span>
            <span className="font-medium text-neutral-900">{tierLabel(firmTier)}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-neutral-500">Per-seat rate</span>
            <span className="font-medium text-neutral-900">
              ${rate.toLocaleString()}/mo per advisor
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-neutral-500">Active seats</span>
            <span className="font-medium text-neutral-900">{seats}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-neutral-100 pt-3 mt-1">
            <span className="text-neutral-700 font-medium">Total monthly (est.)</span>
            <span className="font-semibold text-neutral-900">
              ${monthly.toLocaleString()}/mo
            </span>
          </div>
        </div>
        <div className="mt-6">
          <a
            href="/billing"
            className="inline-flex rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
          >
            Manage Billing 💳
          </a>
        </div>
      </section>

      {/* Section 2 — Advisor roster */}
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Advisor roster
          </h2>
          {rosterError && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              ⚠️ Failed to load advisor roster. Please refresh the page.
            </p>
          )}
        </div>
        {members.length === 0 ? (
          <p className="px-6 py-8 text-sm text-neutral-500 text-center">No members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {members.map((m) => {
                  const isOwner = m.firm_role === 'owner'
                  const roleBadge = isOwner ? (
                    <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
                      Owner
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                      Member
                    </span>
                  )
                  const statusLower = m.status.toLowerCase()
                  const statusBadge =
                    statusLower === 'active' ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        Active
                      </span>
                    ) : statusLower === 'pending' ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                        {m.status}
                      </span>
                    )
                  const showRemove =
                    m.status === 'active' && m.firm_role === 'member' && !isOwner

                  return (
                    <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">
                        {m.display_email}
                      </td>
                      <td className="px-6 py-4">{roleBadge}</td>
                      <td className="px-6 py-4">{statusBadge}</td>
                      <td className="px-6 py-4 text-neutral-600">
                        {m.joined_at ? formatJoined(m.joined_at) : 'Pending'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {showRemove ? (
                          <button
                            type="button"
                            onClick={() => void handleRemove(m.id)}
                            disabled={removingId === m.id}
                            className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {removingId === m.id ? 'Removing…' : 'Remove'}
                          </button>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 3 — Invite */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
          Invite advisor
        </h2>
        <div className="max-w-md space-y-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSendInvite()}
            placeholder="advisor@example.com"
            disabled={inviteLoading}
            className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-50"
          />
          <p className="text-sm text-neutral-500">
            Enter an advisor&apos;s email address above to send them an invite. Each accepted invite
            adds one seat to your firm subscription.
          </p>
          <button
            type="button"
            onClick={() => void handleSendInvite()}
            disabled={inviteLoading || !inviteEmail.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {inviteLoading ? 'Sending…' : 'Send Invite 📨'}
          </button>
          {inviteSuccess && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              {inviteSuccess}
            </p>
          )}
          {inviteError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {inviteError}
            </p>
          )}
        </div>
      </section>

      {/* Section 4 — Danger zone */}
      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-900">Danger Zone ⚠️</h2>
        <div className="mt-4 border-t border-red-200 pt-4">
          <p className="text-sm font-medium text-neutral-900">Leave or dissolve firm</p>
          <p className="mt-1 text-sm text-neutral-600">
            Dissolving your firm will cancel your Stripe subscription, remove all advisor members,
            and permanently close the firm account. This cannot be undone.
          </p>
          {dissolvePhase === 'success' ? (
            <p className="mt-4 text-sm font-medium text-neutral-800">
              Your firm has been dissolved. Redirecting...
            </p>
          ) : dissolvePhase === 'confirm' ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-neutral-900">
                Are you sure? This cannot be undone.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void confirmDissolveFirm()}
                  disabled={dissolveLoading}
                  className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {dissolveLoading ? 'Dissolving…' : 'Yes, dissolve firm'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDissolvePhase('idle')
                    setDissolveError(null)
                  }}
                  disabled={dissolveLoading}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setDissolvePhase('confirm')
                  setDissolveError(null)
                }}
                className="rounded-lg border border-red-600 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition"
              >
                Dissolve Firm ⚠️
              </button>
            </div>
          )}
          {dissolveError && (
            <p className="mt-3 text-sm text-red-600">{dissolveError}</p>
          )}
        </div>
      </section>
    </div>
  )
}
