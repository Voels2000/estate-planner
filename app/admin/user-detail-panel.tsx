'use client'

import { useCallback, useEffect, useState } from 'react'

type UserDetail = {
  id: string
  email: string
  full_name: string | null
  role: string
  consumer_tier: number | null
  attorney_tier: number | null
  subscription_status: string | null
  subscription_plan: string | null
  subscription_period_end: string | null
  stripe_customer_id: string | null
  created_at: string
  terms_accepted_at: string | null
  terms_version: string | null
  last_sign_in_at: string | null
}

const TIER_LABELS: Record<number, string> = {
  0: 'Free (0)',
  1: 'Financial (1)',
  2: 'Retirement (2)',
  3: 'Estate (3)',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

type Props = {
  userId: string | null
  onClose: () => void
}

export default function UserDetailPanel({ userId, onClose }: Props) {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [overrideTier, setOverrideTier] = useState<0 | 1 | 2 | 3>(0)
  const [overrideReason, setOverrideReason] = useState('')
  const [overriding, setOverriding] = useState(false)
  const [showOverride, setShowOverride] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load user')
      setUser(json.data as UserDetail)
      setOverrideTier((json.data.consumer_tier as 0 | 1 | 2 | 3) ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      load()
      setActionMessage(null)
      setShowOverride(false)
      setOverrideReason('')
    } else {
      setUser(null)
    }
  }, [userId, load])

  async function handleSyncStripe() {
    if (!userId) return
    setSyncing(true)
    setActionMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/sync-stripe`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      setActionMessage('Synced from Stripe successfully.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    const confirmed = window.confirm(`Send password reset email to ${user.email}?`)
    if (!confirmed) return

    setResetting(true)
    setActionMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/send-password-reset`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send reset')
      setActionMessage(`Password reset email sent to ${json.email}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset')
    } finally {
      setResetting(false)
    }
  }

  async function handleTierOverride() {
    if (!userId || !overrideReason.trim()) return
    setOverriding(true)
    setActionMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/tier-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumer_tier: overrideTier, reason: overrideReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Override failed')
      setActionMessage(`Tier overridden to ${TIER_LABELS[overrideTier]}.`)
      setShowOverride(false)
      setOverrideReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed')
    } finally {
      setOverriding(false)
    }
  }

  if (!userId) return null

  const tierLabel = TIER_LABELS[user?.consumer_tier ?? 0] ?? `Tier ${user?.consumer_tier ?? '—'}`
  const stripeUrl = user?.stripe_customer_id
    ? `https://dashboard.stripe.com/customers/${user.stripe_customer_id}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white shadow-xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {user?.full_name ?? 'User'}
            </h2>
            <p className="text-sm text-neutral-500">{user?.email ?? '…'}</p>
            {user && (
              <p className="text-xs text-neutral-400 mt-1 capitalize">
                {user.role} · {tierLabel} · {user.subscription_status ?? 'none'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {loading && (
            <p className="text-sm text-neutral-400 animate-pulse">Loading…</p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {actionMessage && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              {actionMessage}
            </p>
          )}

          {user && !loading && (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
                  Account
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Role</dt>
                    <dd className="text-neutral-900 capitalize">{user.role}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Created</dt>
                    <dd className="text-neutral-900">{formatDate(user.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Last sign in</dt>
                    <dd className="text-neutral-900">{formatRelative(user.last_sign_in_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Terms accepted</dt>
                    <dd className="text-neutral-900">{formatDate(user.terms_accepted_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Terms version</dt>
                    <dd className="text-neutral-900">{user.terms_version ?? '—'}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
                  Subscription
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Status</dt>
                    <dd className="text-neutral-900">{user.subscription_status ?? 'none'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Tier</dt>
                    <dd className="text-neutral-900">{tierLabel}</dd>
                  </div>
                  {(user.attorney_tier ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">Attorney tier</dt>
                      <dd className="text-neutral-900">Tier {user.attorney_tier}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Period end</dt>
                    <dd className="text-neutral-900">
                      {formatDate(user.subscription_period_end)}
                    </dd>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <dt className="text-neutral-500 shrink-0">Stripe ID</dt>
                    <dd className="text-neutral-900 font-mono text-xs truncate">
                      {user.stripe_customer_id ?? '—'}
                      {stripeUrl && (
                        <a
                          href={stripeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-[color:var(--mwm-navy)] hover:underline font-sans"
                        >
                          Open in Stripe ↗
                        </a>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
                  Actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSyncStripe}
                    disabled={syncing || !user.stripe_customer_id}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                  >
                    {syncing ? 'Syncing…' : 'Sync from Stripe'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOverride((v) => !v)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-500"
                  >
                    Override tier ▾
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={resetting}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                  >
                    {resetting ? 'Sending…' : 'Send password reset'}
                  </button>
                </div>

                {showOverride && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="text-xs text-amber-800">
                      This overrides the Stripe-derived tier. The next Stripe webhook will reset
                      it unless the subscription matches.
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        Tier
                      </label>
                      <select
                        value={overrideTier}
                        onChange={(e) => setOverrideTier(Number(e.target.value) as 0 | 1 | 2 | 3)}
                        className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      >
                        <option value={0}>Free / Tier 0</option>
                        <option value={1}>Financial / Tier 1</option>
                        <option value={2}>Retirement / Tier 2</option>
                        <option value={3}>Estate / Tier 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        Reason (required)
                      </label>
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Support case reference or explanation"
                        className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleTierOverride}
                      disabled={overriding || !overrideReason.trim()}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {overriding ? 'Applying…' : 'Apply override'}
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
