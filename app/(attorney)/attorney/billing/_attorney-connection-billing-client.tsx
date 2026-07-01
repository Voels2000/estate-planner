'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { AttorneyConnectionBillingSummary } from '@/lib/billing/attorneyConnectionBillingSummary'
import { buildAttorneyRaiseLimitPreview } from '@/lib/billing/attorneyConnectionBillingSummary'
import { MAX_SELF_SERVE_RESETS } from '@/lib/billing/firmConnectionStickyFloor'

type ResetPreview = {
  newLimit: number
  connectedCount: number
  oldBandLabel: string
  newBandLabel: string
  oldRatePerClient: number
  newRatePerClient: number
  newMonthlyEstimate: number
  resetCountAfter: number
  selfServeResetsRemaining: number
  confirmationMessage?: string
}

type Props = {
  firmName: string
  summary: AttorneyConnectionBillingSummary
  subscriptionStatus: string | null
  attorneyCheckoutPriceId: string
  initialAction?: 'raise' | 'lower' | null
  checkoutSuccess?: boolean
  canceled?: boolean
}

export function AttorneyConnectionBillingClient({
  firmName,
  summary,
  subscriptionStatus,
  attorneyCheckoutPriceId,
  initialAction = null,
  checkoutSuccess = false,
  canceled = false,
}: Props) {
  const isOwner = true
  const router = useRouter()
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [showRaiseForm, setShowRaiseForm] = useState(initialAction === 'raise')
  const [showLowerForm, setShowLowerForm] = useState(initialAction === 'lower')
  const [raiseLimitInput, setRaiseLimitInput] = useState(summary.clientLimit + 1)
  const [lowerLimitInput, setLowerLimitInput] = useState(
    Math.max(summary.connectedCount, summary.clientLimit - 1),
  )
  const [checkoutCapacity, setCheckoutCapacity] = useState(
    Math.max(1, summary.clientLimit || 1),
  )
  const [raisePreview, setRaisePreview] = useState<ReturnType<typeof buildAttorneyRaiseLimitPreview> | null>(
    null,
  )
  const [resetPreview, setResetPreview] = useState<ResetPreview | null>(null)
  const [submittingRaise, setSubmittingRaise] = useState(false)
  const [submittingReset, setSubmittingReset] = useState(false)

  const isActive =
    subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  const clearActionParam = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('action=')) {
      router.replace('/attorney/billing', { scroll: false })
    }
  }, [router])

  useEffect(() => {
    if (initialAction === 'raise') setShowRaiseForm(true)
    if (initialAction === 'lower') setShowLowerForm(true)
  }, [initialAction])

  useEffect(() => {
    if (!showRaiseForm || !isOwner || !isActive) {
      setRaisePreview(null)
      return
    }
    if (raiseLimitInput <= summary.clientLimit) {
      setRaisePreview(null)
      return
    }
    setRaisePreview(
      buildAttorneyRaiseLimitPreview({
        connectedCount: summary.connectedCount,
        billingFloor: summary.billingFloor,
        newLimit: raiseLimitInput,
      }),
    )
  }, [
    showRaiseForm,
    isOwner,
    isActive,
    raiseLimitInput,
    summary.clientLimit,
    summary.connectedCount,
    summary.billingFloor,
  ])

  useEffect(() => {
    if (!showLowerForm || !isOwner || !isActive) {
      setResetPreview(null)
      return
    }
    if (
      lowerLimitInput < summary.connectedCount ||
      lowerLimitInput >= summary.clientLimit ||
      summary.resetCount >= MAX_SELF_SERVE_RESETS
    ) {
      setResetPreview(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/attorney/connection-limit/reset?new_limit=${lowerLimitInput}`,
        )
        const data = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) {
          setResetPreview(data as ResetPreview)
        } else if (!cancelled) {
          setResetPreview(null)
        }
      } catch {
        if (!cancelled) setResetPreview(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    showLowerForm,
    isOwner,
    isActive,
    lowerLimitInput,
    summary.connectedCount,
    summary.clientLimit,
    summary.resetCount,
  ])

  async function handleManageBilling() {
    if (!isOwner) return
    setError(null)
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          typeof data.error === 'string'
            ? data.error
            : 'Something went wrong. Please try again.',
        )
        return
      }
      if (data.url && typeof data.url === 'string') {
        window.location.href = data.url
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoadingPortal(false)
    }
  }

  async function handleConnectionCheckout() {
    if (!isOwner) return
    setError(null)
    setLoadingCheckout(true)
    try {
      const res = await fetch('/api/stripe/attorney-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: checkoutCapacity,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          typeof data.error === 'string'
            ? data.error
            : 'Something went wrong. Please try again.',
        )
        return
      }
      if (data.url && typeof data.url === 'string') {
        window.location.href = data.url
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoadingCheckout(false)
    }
  }

  async function handleRaiseConfirm() {
    setError(null)
    setSuccess(null)
    setSubmittingRaise(true)
    try {
      const res = await fetch('/api/attorney/connection-limit/raise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_client_limit: raiseLimitInput }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Raise failed.')
        return
      }
      setSuccess('Client limit raised.')
      setShowRaiseForm(false)
      clearActionParam()
      router.refresh()
    } catch {
      setError('Something went wrong.')
    } finally {
      setSubmittingRaise(false)
    }
  }

  async function handleResetConfirm() {
    setError(null)
    setSuccess(null)
    setSubmittingReset(true)
    try {
      const res = await fetch('/api/attorney/connection-limit/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_limit: lowerLimitInput }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Reset failed.')
        return
      }
      setSuccess('Client limit lowered.')
      setShowLowerForm(false)
      clearActionParam()
      router.refresh()
    } catch {
      setError('Something went wrong.')
    } finally {
      setSubmittingReset(false)
    }
  }

  const checkoutEstimate =
    checkoutCapacity * summary.ratePerClient || checkoutCapacity * 120

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6">
        <ButtonLink
          href="/attorney"
          variant="link"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Back to portal
        </ButtonLink>
      </div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Attorney billing
        </h1>
        <p className="mt-2 text-neutral-600">
          Connection billing for {firmName}.
        </p>
      </div>

      {checkoutSuccess && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Subscription active. You can connect additional client households up to your
          purchased capacity.
        </div>
      )}
      {canceled && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Checkout was canceled. You can try again when ready.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      {summary.pageState === 'at_capacity' && isActive && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;ve connected all {summary.clientLimit} clients in your plan.
          {isOwner && (
            <>
              {' '}
              Raise your limit to connect more households.
            </>
          )}
        </div>
      )}

      {summary.pageState === 'floor_above_connected' && isActive && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          Billed for {summary.billingFloor} (your capacity). Connected:{' '}
          {summary.connectedCount}. You&apos;re billed for your capacity, not
          current connections.
          {isOwner && summary.canLowerLimit && (
            <> Lower your limit to reduce your bill.</>
          )}
        </div>
      )}

      <Card className="space-y-6 rounded-2xl p-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Firm summary
          </h2>
          <p className="mt-1 text-lg font-medium text-neutral-900">{firmName}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Plan</h3>
            <p className="mt-1 text-neutral-900">{summary.planLine}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Rate</h3>
            <p className="mt-1 text-neutral-900">
              ${summary.ratePerClient} / connected client / month
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Connected now</h3>
            <p className="mt-1 text-neutral-900">{summary.connectedCapacityLine}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Billing floor</h3>
            <p className="mt-1 text-neutral-900">
              {summary.billingFloor}{' '}
              <span className="text-sm text-neutral-500">
                (minimum you&apos;re billed for)
              </span>
            </p>
          </div>
          <div className="sm:col-span-2">
            <h3 className="text-sm font-medium text-neutral-500">Est. monthly</h3>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              ${summary.estimatedMonthly.toLocaleString('en-US')}/mo
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {summary.billableQuantity} billable × ${summary.ratePerClient}/client
            </p>
          </div>
        </div>

        {isOwner && isActive && (
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="button"
              onClick={() => void handleManageBilling()}
              disabled={loadingPortal}
              variant="primary"
              className="rounded-lg px-4 py-2.5 text-sm"
            >
              {loadingPortal ? 'Loading…' : 'Manage payment method'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowRaiseForm((v) => !v)
                setShowLowerForm(false)
              }}
              variant="outline"
              className="rounded-lg px-4 py-2.5 text-sm"
            >
              {summary.pageState === 'at_capacity'
                ? 'Raise limit to connect more'
                : 'Raise limit'}
            </Button>
            {summary.canLowerLimit && (
              <Button
                type="button"
                onClick={() => {
                  setShowLowerForm((v) => !v)
                  setShowRaiseForm(false)
                }}
                variant="outline"
                className="rounded-lg px-4 py-2.5 text-sm"
              >
                Lower limit
              </Button>
            )}
          </div>
        )}

        {isOwner && !isActive && (
          <div className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="firm-connection-capacity"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Client capacity to purchase
              </label>
              <input
                id="firm-connection-capacity"
                type="number"
                min={1}
                max={250}
                value={checkoutCapacity}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value, 10)
                  setCheckoutCapacity(Number.isNaN(parsed) ? 1 : parsed)
                }}
                className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <p className="mt-2 text-sm font-semibold text-neutral-900">
                Est. ${checkoutEstimate.toLocaleString('en-US')}/month at current band rate
              </p>
            </div>
            <p className="text-sm leading-relaxed text-neutral-700">
              {BILLING_DISCLOSURES.preCheckout(
                summary.planLine,
                `$${checkoutEstimate.toLocaleString('en-US')}`,
                'month',
              )}
            </p>
            <Button
              type="button"
              onClick={() => void handleConnectionCheckout()}
              disabled={loadingCheckout}
              variant="primary"
              className="rounded-lg px-4 py-2.5 text-sm"
            >
              {loadingCheckout ? 'Redirecting…' : 'Subscribe now'}
            </Button>
          </div>
        )}
      </Card>

      {isOwner && showRaiseForm && isActive && (
        <Card className="mt-6 space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Raise client limit</h2>
          <p className="text-sm text-neutral-600">
            Add prepaid headroom before connecting more households. Your bill updates
            when you connect into the new capacity.
          </p>
          <div>
            <label
              htmlFor="raise-limit"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              New client limit (current: {summary.clientLimit})
            </label>
            <input
              id="raise-limit"
              type="number"
              min={summary.clientLimit + 1}
              max={250}
              value={raiseLimitInput}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10)
                setRaiseLimitInput(
                  Number.isNaN(parsed) ? summary.clientLimit + 1 : parsed,
                )
              }}
              className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          {raisePreview && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
              <p>
                {raisePreview.currentBandLabel} (${raisePreview.currentRatePerClient}
                /client) → {raisePreview.newBandLabel} ($
                {raisePreview.newRatePerClient}/client)
              </p>
              <p className="mt-2">
                Est. monthly now: ${raisePreview.newMonthly.toLocaleString('en-US')}
                {raisePreview.rateImproved && (
                  <span className="text-green-700">
                    {' '}
                    — lower per-client rate in the {raisePreview.newBandLabel} band
                  </span>
                )}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => void handleRaiseConfirm()}
              disabled={
                submittingRaise || raiseLimitInput <= summary.clientLimit || !raisePreview
              }
              variant="primary"
              className="rounded-lg px-4 py-2.5 text-sm"
            >
              {submittingRaise ? 'Saving…' : 'Confirm raise'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowRaiseForm(false)
                clearActionParam()
              }}
              variant="outline"
              className="rounded-lg px-4 py-2.5 text-sm"
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isOwner && showLowerForm && isActive && (
        <Card className="mt-6 space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Lower client limit</h2>
          {summary.resetCount >= MAX_SELF_SERVE_RESETS ? (
            <p className="text-sm text-neutral-700">
              You&apos;ve used your 2 self-serve limit reductions. Contact support to
              adjust further.
            </p>
          ) : (
            <>
              <p className="text-sm text-neutral-600">
                Lowering reduces your billing floor and monthly estimate. You cannot set
                a limit below connected households ({summary.connectedCount}).
              </p>
              <div>
                <label
                  htmlFor="lower-limit"
                  className="mb-1.5 block text-sm font-medium text-neutral-700"
                >
                  New client limit (max below current {summary.clientLimit})
                </label>
                <input
                  id="lower-limit"
                  type="number"
                  min={summary.connectedCount}
                  max={summary.clientLimit - 1}
                  value={lowerLimitInput}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setLowerLimitInput(
                      Number.isNaN(parsed)
                        ? summary.connectedCount
                        : parsed,
                    )
                  }}
                  disabled={summary.clientLimit <= summary.connectedCount}
                  className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
                />
                {lowerLimitInput < summary.connectedCount && (
                  <p className="mt-2 text-sm text-red-600">
                    Cannot set limit below {summary.connectedCount} connected{' '}
                    {summary.connectedCount === 1 ? 'household' : 'households'}.
                  </p>
                )}
              </div>
              {resetPreview && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {resetPreview.confirmationMessage ??
                    `Lowering to ${resetPreview.newLimit} moves you from ${resetPreview.oldBandLabel} ($${resetPreview.oldRatePerClient}/client) to ${resetPreview.newBandLabel} ($${resetPreview.newRatePerClient}/client). New monthly estimate: $${resetPreview.newMonthlyEstimate}. This is reset ${resetPreview.resetCountAfter} of 2.`}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => void handleResetConfirm()}
                  disabled={
                    submittingReset ||
                    lowerLimitInput < summary.connectedCount ||
                    lowerLimitInput >= summary.clientLimit ||
                    !resetPreview
                  }
                  variant="primary"
                  className="rounded-lg px-4 py-2.5 text-sm"
                >
                  {submittingReset ? 'Saving…' : 'Confirm lower limit'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowLowerForm(false)
                    clearActionParam()
                  }}
                  variant="outline"
                  className="rounded-lg px-4 py-2.5 text-sm"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
