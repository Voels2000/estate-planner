'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  isEnrolled: boolean
  factorId?: string
}

export default function SecurityClient({ isEnrolled, factorId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRemove(e: FormEvent) {
    e.preventDefault()
    if (!factorId) {
      setError('Could not load authenticator. Refresh the page and try again.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      })
      if (verifyError) {
        setError('Invalid code. Try again.')
        return
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      })
      if (unenrollError) {
        setError(unenrollError.message || 'Could not remove authenticator.')
        return
      }

      setCode('')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isEnrolled) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium text-neutral-900">
          Two-factor authentication
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Add a time-based one-time password (TOTP) from an app like Google
          Authenticator or 1Password. You will be asked for a code when you sign
          in.
        </p>
        <Link
          href="/mfa-enroll"
          className="mt-5 inline-flex rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Set up authenticator
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-neutral-900">
            Two-factor authentication
          </h2>
          <p className="mt-1 text-sm text-emerald-700">Enabled</p>
          <p className="mt-2 text-sm text-neutral-600">
            Your account is protected with an authenticator app. To turn it off,
            enter a current code from your app.
          </p>
        </div>
      </div>

      <form onSubmit={handleRemove} className="mt-6 space-y-4 border-t border-neutral-100 pt-6">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Authenticator code
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="mt-1.5 block w-full max-w-xs rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-lg tracking-widest text-neutral-900 shadow-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={code.length !== 6 || loading}
          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Removing…' : 'Remove authenticator'}
        </button>
      </form>
    </div>
  )
}
