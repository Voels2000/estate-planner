'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function MFAEnrollPage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrollLoading, setEnrollLoading] = useState(true)
  const [enrollSuccess, setEnrollSuccess] = useState(false)

  useEffect(() => {
    const client = createClient()
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login')
    })
  }, [router])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    async function enroll() {
      setEnrollLoading(true)
      setError('')
      const { data: factors } = await supabase.auth.mfa.listFactors()
      if (cancelled) return
      if (factors?.totp && factors.totp.length > 0) {
        router.replace('/settings/security')
        return
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator',
        issuer: 'Estate Planner',
      })
      if (cancelled) return
      if (enrollError || !data?.id || !data.totp) {
        setError(enrollError?.message ?? 'Could not start enrollment.')
        setEnrollLoading(false)
        return
      }
      setFactorId(data.id)
      setSecret(data.totp.secret)
      setQrSvg(data.totp.qr_code)
      setEnrollLoading(false)
    }
    enroll()
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleVerify(e?: FormEvent) {
    e?.preventDefault()
    if (!factorId) return
    setLoading(true)
    setError('')
    const supabase = createClient()

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      })
      if (verifyError) {
        setError('Invalid code. Check your app and try again.')
        return
      }
      setEnrollSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 3000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Set up authenticator
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Scan the QR code with your app, or enter the secret manually. Then
          enter a 6-digit code to confirm.
        </p>

        {enrollLoading && (
          <p className="mt-8 text-sm text-zinc-500">Preparing…</p>
        )}

        {!enrollLoading && error && !qrSvg && (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        )}

        {qrSvg && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <div
              className="h-64 w-64 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700"
              style={{ overflow: 'hidden' }}
              dangerouslySetInnerHTML={{
                __html:
                  qrSvg?.replace('<svg ', '<svg style="width:100%;height:100%" ') ??
                  '',
              }}
            />
            {secret && (
              <div className="w-full rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Secret
                </p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">
                  {secret}
                </p>
              </div>
            )}
          </div>
        )}

        {enrollSuccess && (
          <div className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">
            ✅ Authenticator set up successfully! Redirecting to your dashboard…
          </div>
        )}

        {qrSvg && (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-2xl tracking-widest text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={code.length !== 6 || loading}
              className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? 'Confirming…' : 'Confirm and enable'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link
            href="/settings/security"
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Cancel
          </Link>
        </p>
      </div>
    </div>
  )
}
