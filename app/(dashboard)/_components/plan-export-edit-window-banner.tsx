'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { daysUntilPlanExportLock } from '@/lib/billing/planExportAccess'
import { planAndExportAmountCents } from '@/lib/billing/oneTimePurchases'

const SESSION_DISMISS_KEY = 'mwm_plan_export_window_banner_dismissed'

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

type Props = {
  editWindowEndsAt: string
}

export function PlanExportEditWindowBanner({ editWindowEndsAt }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissedFor = sessionStorage.getItem(SESSION_DISMISS_KEY)
    if (dismissedFor === editWindowEndsAt) return
    setVisible(true)
  }, [editWindowEndsAt])

  if (!visible) return null

  const lockDate = new Date(editWindowEndsAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const daysRemaining = daysUntilPlanExportLock(editWindowEndsAt)
  const disclosure = BILLING_DISCLOSURES.planExportWindowWarningEmail(
    daysRemaining <= 3 ? 3 : 14,
    lockDate,
  )
  const priceDisplay = `$${(planAndExportAmountCents() / 100).toLocaleString('en-US')}`

  return (
    <div
      className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4"
      data-testid="plan-export-window-banner"
      role="status"
    >
      <LockIcon className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-950">Plan &amp; Export editing window</p>
        <p className="mt-1 text-sm text-amber-900">{disclosure.body}</p>
        <p className="mt-2 text-xs text-amber-800/90">
          {BILLING_DISCLOSURES.planAndExportCheckout(priceDisplay)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:self-center">
        <Link
          href="/billing?plan=estate"
          className="inline-flex items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          Subscribe to keep editing →
        </Link>
        <p className="text-xs text-amber-800/90">
          Your Plan &amp; Export purchase counts toward your subscription if you upgrade.
        </p>
        <button
          type="button"
          className="text-xs text-amber-800 underline underline-offset-2"
          onClick={() => {
            sessionStorage.setItem(SESSION_DISMISS_KEY, editWindowEndsAt)
            setVisible(false)
          }}
        >
          Dismiss for now
        </button>
      </div>
    </div>
  )
}
