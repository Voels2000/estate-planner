'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  token: string
  advisorName: string
  invitedEmail: string
}

export default function InviteClient({ token, advisorName, invitedEmail }: Props) {
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setAccepting(true)
    setError(null)

    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setAccepting(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setAccepting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
          <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 text-center">
          Advisor Invitation
        </h1>

        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 text-center">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{advisorName}</span> has
          invited you to connect on MyWealthMaps.
        </p>

        <div className="mt-6 rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4 space-y-2 text-sm">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">By accepting you agree to:</p>
          <ul className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">✓</span>
              Share your estate planning data with your advisor
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">✓</span>
              Allow your advisor to view your plan — your advisor has view-only access and cannot make changes to your data
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">✓</span>
              Transfer billing to your advisor — your current subscription will cancel at the end of its billing period
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">✓</span>
              You retain full access to your own dashboard at all times
            </li>
          </ul>
          <p className="pt-1 text-xs text-zinc-400 dark:text-zinc-500">
            You remain in control of your data. You can disconnect from your advisor at any time.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {accepting ? 'Accepting…' : 'Accept Invitation'}
          </button>
          <a
            href="/dashboard"
            className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-center text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Decline
          </a>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-400">
          Invited as {invitedEmail}
        </p>

      </div>
    </div>
  )
}
