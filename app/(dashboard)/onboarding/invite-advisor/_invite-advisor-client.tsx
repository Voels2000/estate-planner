'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
type Props = {
  inviteEmailSubject: string
  inviteEmailBody: string
  consumerName: string
}

export function InviteAdvisorOnboardingClient({
  inviteEmailSubject,
  inviteEmailBody,
  consumerName,
}: Props) {
  const router = useRouter()
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function completeOnboarding() {
    setSkipping(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/onboarding-invite-advisor', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to continue')
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSkipping(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-blue-700">Step 2 of 2</p>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--mwm-navy)]">Invite your advisor</h1>
        <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
          Hi {consumerName.split(' ')[0] || 'there'} — many clients work with a financial advisor or CPA.
          Invite yours so they can view your plan and collaborate on My Wealth Maps.
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={`mailto:?subject=${inviteEmailSubject}&body=${inviteEmailBody}`}
            className="flex w-full items-center justify-center rounded-lg bg-[color:var(--mwm-navy)] px-4 py-3 text-sm font-medium text-white hover:bg-[color:var(--mwm-navy-light)] transition"
          >
            Email my advisor an invite
          </a>
          <Link
            href="/find-advisor"
            className="flex w-full items-center justify-center rounded-lg border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition"
          >
            Find an advisor in the directory
          </Link>
          <button
            type="button"
            className="w-full rounded-lg px-4 py-3 text-sm font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 transition disabled:opacity-50"
            disabled={skipping}
            onClick={() => void completeOnboarding()}
          >
            {skipping ? 'Continuing…' : 'Skip for now'}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <p className="mt-6 text-xs text-neutral-400">
          You can always invite an advisor later from{' '}
          <Link href="/my-advisor" className="underline">
            My Advisor
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
