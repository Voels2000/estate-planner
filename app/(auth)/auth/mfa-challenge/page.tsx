'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass } from '@/components/ui/form'

export default function MFAChallengePage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const client = createClient()
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login')
    })
  }, [router])

  async function handleVerify(e?: FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]

      if (!totpFactor) {
        setError('No authenticator found. Please enroll first.')
        return
      }

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id })

      if (challengeError) throw challengeError
      if (!challenge?.id) {
        setError('Could not start verification. Please try again.')
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      })

      if (verifyError) {
        setError('Invalid code. Please try again.')
        return
      }

      const { data: { user: verifiedUser } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_superuser, subscription_status')
        .eq('id', verifiedUser!.id)
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
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const otpClass = `${formControlClass} px-4 py-3 text-center text-2xl tracking-widest`

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans dark:bg-zinc-950">
      <Card className="w-full max-w-sm rounded-2xl p-8 shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
          Two-Factor Authentication
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
          Enter the 6-digit code from your authenticator app.
        </p>

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
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
