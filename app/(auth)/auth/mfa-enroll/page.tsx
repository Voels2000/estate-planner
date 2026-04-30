'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass } from '@/components/ui/form'

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
        void (async () => {
          const { data: { user: enrolledUser } } = await supabase.auth.getUser()
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_superuser, subscription_status')
            .eq('id', enrolledUser!.id)
            .single()

          const role = profile?.role ?? ''
          const isSuperuser = profile?.is_superuser === true
          const isAdvisor = isSuperuser || role === 'advisor'
          const isAttorney = role === 'attorney'
          const hasActiveSubscription =
            profile?.subscription_status === 'active' ||
            profile?.subscription_status === 'trialing'

          if (isAttorney) {
            router.push('/attorney')
          } else if (isAdvisor && !hasActiveSubscription) {
            router.push('/billing')
          } else {
            router.push('/dashboard')
          }
          router.refresh()
        })()
      }, 2000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const otpClass = `${formControlClass} px-4 py-3 text-center text-2xl tracking-widest`

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans dark:bg-zinc-950">
      <Card className="w-full max-w-md rounded-2xl p-8 shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
          Set up authenticator
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
          Scan the QR code with your app, or enter the secret manually. Then
          enter a 6-digit code to confirm.
        </p>

        {enrollLoading && (
          <p className="mt-8 text-sm text-neutral-500">Preparing…</p>
        )}

        {!enrollLoading && error && !qrSvg && (
          <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {qrSvg && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <div
              className="h-64 w-64 rounded-lg border border-neutral-200 bg-white p-2 dark:border-zinc-700"
              style={{ overflow: 'hidden' }}
              dangerouslySetInnerHTML={{
                __html:
                  qrSvg?.replace('<svg ', '<svg style="width:100%;height:100%" ') ??
                  '',
              }}
            />
            {secret && (
              <div className="w-full rounded-lg bg-neutral-100 px-3 py-2 dark:bg-zinc-800">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Secret
                </p>
                <p className="mt-1 break-all font-mono text-xs text-neutral-800 dark:text-zinc-200">
                  {secret}
                </p>
              </div>
            )}
          </div>
        )}

        {enrollSuccess && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            ✅ Authenticator set up successfully! Redirecting…
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
              className={otpClass}
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={code.length !== 6 || loading}
              className="w-full rounded-lg py-2.5 text-sm font-medium"
            >
              {loading ? 'Confirming…' : 'Confirm and enable'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <ButtonLink href="/settings/security" variant="link">
            Cancel
          </ButtonLink>
        </p>
      </Card>
    </div>
  )
}
