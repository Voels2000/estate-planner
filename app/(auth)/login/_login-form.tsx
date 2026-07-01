'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveAdvisorPostLoginPath } from '@/lib/access/advisorBillingGate'
import { getSignupHref } from '@/lib/waitlist-mode'
import { consumeIntakeToken, storeIntakeToken } from '@/lib/attorney/intakeTokenSession'
import { consumerAttorneyBillingBlockedMessage } from '@/lib/billing/attorneyConnectBillingGateClient'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass, formLabelClass } from '@/components/ui/form'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo =
    searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/dashboard'
  const claimRedirect = redirectTo.startsWith('/claim/') ? redirectTo : null
  const professionalReturn =
    claimRedirect != null ||
    redirectTo.startsWith('/attorney') ||
    redirectTo.startsWith('/advisor')
  const emailFromQuery = searchParams.get('email') ?? ''
  const intakeTokenParam = searchParams.get('intake_token')?.trim() ?? ''
  const signupHref = getSignupHref()

  useEffect(() => {
    if (intakeTokenParam) storeIntakeToken(intakeTokenParam)
  }, [intakeTokenParam])

  async function tryCompleteIntakeAfterLogin() {
    const token = consumeIntakeToken() ?? intakeTokenParam
    if (!token) return
    try {
      const res = await fetch('/api/consumer/complete-intake-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeToken: token }),
      })
      const data = await res.json().catch(() => ({}))
      const blocked = consumerAttorneyBillingBlockedMessage(data, res.status)
      if (blocked) {
        sessionStorage.setItem('mwm:attorney_billing_blocked', blocked)
      }
    } catch {
      // non-fatal — profile completion may still be needed
    }
  }

  const [email, setEmail] = useState(emailFromQuery)
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your email address.')
      return
    }

    setError(null)
    setMagicLinkLoading(true)
    try {
      const supabase = createClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      })
      if (otpError) {
        setError(otpError.message)
        return
      }
      setMagicLinkSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setMagicLinkLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setIsSubmitting(false)
        return
      }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut()
        router.push(`/auth/confirm-email?email=${encodeURIComponent(email)}`)
        router.refresh()
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, subscription_status, firm_role, is_superuser, firm_id')
        .eq('id', data.user.id)
        .single()

      if (profile?.is_superuser) {
        router.push(redirectTo)
        router.refresh()
        return
      }

      if (profile?.role === 'attorney') {
        router.push(claimRedirect ?? '/attorney')
        router.refresh()
      } else if (profile?.role === 'advisor') {
        let firmSubscriptionStatus: string | null = null
        if (profile.firm_id) {
          const { data: firm } = await supabase
            .from('firms')
            .select('subscription_status')
            .eq('id', profile.firm_id)
            .maybeSingle()
          firmSubscriptionStatus = firm?.subscription_status ?? null
        }

        router.push(
          resolveAdvisorPostLoginPath({
            redirectTo,
            claimRedirect,
            firmRole: profile.firm_role,
            profileSubscriptionStatus: profile.subscription_status,
            firmSubscriptionStatus,
          }),
        )
        router.refresh()
      } else {
        await tryCompleteIntakeAfterLogin()
        router.push(redirectTo)
        router.refresh()
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans dark:bg-zinc-950">
      <Card className="w-full max-w-md rounded-2xl p-8 shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
          Sign in to your account
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
          {professionalReturn
            ? 'Sign in with a password, or email yourself a link — no password required.'
            : 'Welcome back. Enter your details to access your My Wealth Maps account.'}
        </p>

        {magicLinkSent ? (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
            <p className="font-medium">Check your email</p>
            <p className="mt-1">
              We sent a sign-in link to <span className="font-medium">{email}</span>. Click it to
              continue{claimRedirect ? ' and finish your claim' : ''}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="mt-6 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-zinc-100">
                Email me a sign-in link
              </p>
              {professionalReturn && (
                <p className="mt-1 text-xs text-neutral-600 dark:text-zinc-400">
                  For advisors and attorneys who haven&apos;t set a password yet.
                </p>
              )}
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={magicLinkLoading || !email.trim()}
              className="w-full rounded-lg py-2.5 text-sm font-medium"
            >
              {magicLinkLoading ? 'Sending…' : 'Email me a link'}
            </Button>
          </form>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className={formLabelClass}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={formControlClass}
              placeholder="you@example.com"
            />
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-zinc-500">
            Or sign in with password
          </p>

          <div className="space-y-1.5">
            <label htmlFor="password" className={formLabelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={formControlClass}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="text-right">
            <a
              href="/forgot-password"
              className="text-xs text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy)] dark:text-[color:var(--mwm-text-muted)] dark:hover:text-indigo-300"
            >
              Forgot password?
            </a>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full rounded-lg py-2.5 text-sm font-medium shadow-sm"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-zinc-400">
          Don&apos;t have an account?{' '}
          <a
            href={signupHref}
            className="font-medium text-[color:var(--mwm-navy)] underline-offset-4 hover:text-[color:var(--mwm-navy)] hover:underline dark:text-[color:var(--mwm-text-muted)] dark:hover:text-indigo-300"
          >
            Create one
          </a>
        </p>
      </Card>
    </div>
  )
}
