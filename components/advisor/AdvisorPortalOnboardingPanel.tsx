'use client'

import Link from 'next/link'

type Props = {
  connectedCount: number
  pendingRequestCount: number
  firmBillingActive: boolean
  connectionRatePerHousehold: number
  onConnectClick: () => void
}

export function AdvisorPortalOnboardingPanel({
  connectedCount,
  pendingRequestCount,
  firmBillingActive,
  connectionRatePerHousehold,
  onConnectClick,
}: Props) {
  if (firmBillingActive || connectedCount > 0) return null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[color:var(--mwm-gold)]/30 bg-[color:var(--mwm-gold-pale)]/50 px-4 py-4">
        <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
          No connected clients yet
        </p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          Connecting your first client starts connection billing — you are only charged per
          connected household once someone is linked. Nothing is charged until you connect
          someone.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Connected clients
          </p>
          <p className="mt-1 text-2xl font-semibold text-[color:var(--mwm-navy)]">
            {connectedCount}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Pending requests
          </p>
          <p className="mt-1 text-2xl font-semibold text-[color:var(--mwm-navy)]">
            {pendingRequestCount}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Connection billing
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--mwm-navy)]">
            {firmBillingActive ? 'Active' : 'Set up when you connect'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Firm connection billing</p>
            <p className="mt-1 text-sm text-neutral-600">
              Set up billing now, or wait until your first client connects — from $
              {connectionRatePerHousehold}/month per connected household at starter volume.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConnectClick}
              className="rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
            >
              Connect your first client
            </button>
            <Link
              href="/billing"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition"
            >
              Set up billing
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
