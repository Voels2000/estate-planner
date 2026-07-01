'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass, formLabelClass } from '@/components/ui/form'

type Phase = 'password' | 'mfa'

export function SecurityStepUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const safeRedirect =
    redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
      ? redirectTo
      : '/dashboard'

  const [phase, setPhase] = useState<Phase>('password')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    if (phase !== 'mfa') return
    let cancelled = false
    setEnrolling(true)
    void (async () => {
      const supabase = createClient()
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'My Wealth Maps',
      })
      if (cancelled) return
      if (enrollError || !data) {
        setError('Could not start authenticator setup. Please try again.')
        setEnrolling(false)
        return
      }
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setEnrolling(false)
    })()
    return () => {
      cancelled = true
    }
  }, [phase])

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setPhase('mfa')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaVerify() {
    if (!factorId || code.length !== 6) return
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: challengeError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      })
      if (challengeError) {
        setError('Invalid code. Please try again.')
        return
      }

      const { error: metaError } = await supabase.auth.updateUser({
        data: { security_step_up_at: new Date().toISOString() },
      })
      if (metaError) {
        setError(metaError.message)
        return
      }

      router.push(safeRedirect)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md rounded-2xl p-8 shadow-sm ring-1 ring-neutral-200">
        <h1 className="text-2xl font-semibold text-neutral-900">Secure your account</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Before accessing client or plan data, set a password and enroll two-factor
          authentication. Both steps are required — your sensitive action waits until you finish.
        </p>

        {phase === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <div>
              <label className={formLabelClass} htmlFor="password">
                Create password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={formControlClass}
              />
            </div>
            <div>
              <label className={formLabelClass} htmlFor="confirm_password">
                Confirm password
              </label>
              <input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={formControlClass}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Saving…' : 'Continue to two-factor setup'}
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            {enrolling && (
              <p className="text-sm text-neutral-500 text-center">Setting up authenticator…</p>
            )}
            {!enrolling && qrCode && (
              <>
                <div className="flex flex-col items-center">
                  <img src={qrCode} alt="Authenticator QR code" width={160} height={160} />
                  <p className="mt-2 text-xs text-neutral-500 font-mono break-all">{secret}</p>
                </div>
                <div>
                  <label className={formLabelClass} htmlFor="totp_code">
                    6-digit code
                  </label>
                  <input
                    id="totp_code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className={formControlClass}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  type="button"
                  disabled={loading || code.length !== 6}
                  className="w-full"
                  onClick={() => void handleMfaVerify()}
                >
                  {loading ? 'Verifying…' : 'Finish setup and continue'}
                </Button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
