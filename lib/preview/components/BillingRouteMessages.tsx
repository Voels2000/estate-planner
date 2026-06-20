'use client'

import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/** Mirrors `/billing` server branch: advisor firm member (non-owner). */
export function AdvisorMemberBillingBlock() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <Card className="p-8">
        <div className="mb-4 text-4xl">🏢</div>
        <h1 className="text-2xl font-bold text-neutral-900">Billing</h1>
        <p className="mt-4 leading-relaxed text-neutral-600">
          Your billing is managed by your firm owner. Contact your firm administrator for
          billing questions.
        </p>
        <div className="mt-10">
          <ButtonLink href="/dashboard" variant="link" className="text-sm font-medium">
            ← Back to Dashboard
          </ButtonLink>
        </div>
      </Card>
    </div>
  )
}

/** Mirrors `/billing` server branch: `subscription_status === 'advisor_managed'`. */
export function AdvisorManagedBillingBlock() {
  return (
    <div className="mx-auto mt-16 max-w-2xl px-6">
      <Card className="border-blue-200 bg-blue-50 px-6 py-5">
        <h2 className="mb-1 text-lg font-semibold text-blue-900">
          Your plan is managed by your advisor
        </h2>
        <p className="text-sm text-blue-800">
          No payment required. Your advisor covers access to MyWealthMaps on your behalf. Contact
          your advisor if you have billing questions.
        </p>
      </Card>
    </div>
  )
}
