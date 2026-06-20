'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { storeIntakeToken } from '@/lib/attorney/intakeTokenSession'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass, formLabelClass } from '@/components/ui/form'
import { BETA_SIGNUP_ACCESS_PARAM } from '@/lib/waitlist-mode'
import { inferSignupAdmissionFromClient } from '@/lib/auth/signupAdmission'
import { signupPasswordMinLength, validateSignupPassword } from '@/lib/auth/signupPolicy'

// FIX: canonical role values — 'advisor' not 'financial_advisor'
type Role = 'consumer' | 'advisor' | 'attorney'

type SignupFormProps = {
  betaAccessActive?: boolean
  betaLabel?: string | null
  signupOpen?: boolean
}

export function SignupForm({
  betaAccessActive = false,
  betaLabel = null,
  signupOpen = false,
}: SignupFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [fullName, setFullName] = useState('')
  const inviteEmail = searchParams.get('email') || ''
  const advisorInviteToken = searchParams.get('invite') || ''
  const hasAdvisorInvite = advisorInviteToken !== ''
  const consumerConnectToken = searchParams.get('connect')?.trim() ?? ''
  const hasConsumerConnect = consumerConnectToken !== ''
  const intakeTokenParam = searchParams.get('intake_token')?.trim() ?? ''
  const firmInviteToken = searchParams.get('invite_token')?.trim() ?? ''
  const firmIdParam = searchParams.get('firm_id')?.trim() ?? ''
  const hasFirmInvite = firmInviteToken !== '' && firmIdParam !== ''
  const connectionToken = searchParams.get('connectionToken')?.trim() ?? ''
  const betaAccessToken = searchParams.get(BETA_SIGNUP_ACCESS_PARAM)?.trim() ?? ''
  const redirectTo = searchParams.get('redirectTo')?.trim() ?? ''

  useEffect(() => {
    if (intakeTokenParam) storeIntakeToken(intakeTokenParam)
  }, [intakeTokenParam])

  const [email, setEmail] = useState(inviteEmail)
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(
    hasFirmInvite && !hasAdvisorInvite
      ? 'advisor'
      : hasConsumerConnect
        ? 'advisor'
        : 'consumer',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsError, setTermsError] = useState(false)

  const effectiveRole: Role = hasAdvisorInvite ? 'consumer' : role
  const passwordMin = signupPasswordMinLength(
    inferSignupAdmissionFromClient({
      betaAccessActive,
      betaAccessToken: betaAccessActive ? betaAccessToken : undefined,
      advisorInviteToken: advisorInviteToken || undefined,
      firmInviteToken: firmInviteToken || undefined,
      firmId: firmIdParam || undefined,
      connectToken: consumerConnectToken || undefined,
      connectionToken: connectionToken || undefined,
      signupOpen,
    }),
    effectiveRole,
  )

  async function handleSubmit() {
    setError(null)
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }
    const admission = inferSignupAdmissionFromClient({
      betaAccessActive,
      betaAccessToken: betaAccessActive ? betaAccessToken : undefined,
      advisorInviteToken: advisorInviteToken || undefined,
      firmInviteToken: firmInviteToken || undefined,
      firmId: firmIdParam || undefined,
      connectToken: consumerConnectToken || undefined,
      connectionToken: connectionToken || undefined,
      signupOpen,
    })
    const passwordError = validateSignupPassword(password, admission, effectiveRole)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (!termsAccepted) {
      setTermsError(true)
      return
    }
    setIsSubmitting(true)

    try {
      const termsAcceptedAt = new Date().toISOString()

      const referralCode =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('mwm_referral_code') ?? undefined
          : undefined
      const referralSlug =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('mwm_referral_slug') ?? undefined
          : undefined
      const attorneyReferralCode =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('mwm_attorney_referral_code') ?? undefined
          : undefined
      const attorneyReferralSlug =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('mwm_attorney_referral_slug') ?? undefined
          : undefined

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role: effectiveRole,
          termsAcceptedAt,
          admission,
          referralCode,
          referralSlug,
          attorneyReferralCode,
          attorneyReferralSlug,
          betaLabel,
          betaAccessActive,
          redirectTo: redirectTo || undefined,
        }),
      })

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        nextPath?: string
        session?: boolean
        needsEmailConfirmation?: boolean
      }

      if (!res.ok) {
        setError(payload.error ?? 'Something went wrong. Please try again.')
        setIsSubmitting(false)
        return
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('mwm_referral_code')
        sessionStorage.removeItem('mwm_referral_slug')
        sessionStorage.removeItem('mwm_attorney_referral_code')
        sessionStorage.removeItem('mwm_attorney_referral_slug')
      }

      const nextPath =
        payload.nextPath ??
        `/auth/confirm-email?email=${encodeURIComponent(email.trim())}`

      router.push(nextPath)
      router.refresh()
      setIsSubmitting(false)
    } catch {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans dark:bg-zinc-950">
      <Card className="w-full max-w-md rounded-2xl p-8 shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
          Get started with your estate planning workspace.
        </p>

        {hasAdvisorInvite && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            👋 Your financial advisor has invited you to MyWealthMaps. Create your account to get
            started — no subscription required.
          </div>
        )}

        {hasConsumerConnect && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            A client invited you to join My Wealth Maps as their advisor. Create your account to
            connect.
          </div>
        )}

        {hasFirmInvite && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200">
            🏢 You&apos;ve been invited to join a firm on MyWealthMaps. Complete your signup to accept.
          </div>
        )}

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="fullName" className={formLabelClass}>
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={formControlClass}
              placeholder="Jane Doe"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className={formLabelClass}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              readOnly={hasAdvisorInvite}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${formControlClass} ${
                hasAdvisorInvite ? 'cursor-not-allowed bg-neutral-100 text-neutral-600 dark:bg-zinc-900 dark:text-zinc-400' : ''
              }`}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className={formLabelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={passwordMin}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={formControlClass}
              placeholder={`At least ${passwordMin} characters`}
            />
          </div>

          {hasAdvisorInvite ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              You&apos;re signing up as a client. You will have full access to your own dashboard. Your advisor will have view-only access to support your planning.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className={formLabelClass}>Role</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['consumer', 'Consumer', 'Manage your own estate planning.'],
                    // FIX: value is now 'advisor' — matches canonical role in profiles table
                    ['advisor', 'Financial Advisor', 'Support clients with their estate plans.'],
                    ['attorney', 'Attorney', 'Review and support client estate documents.'],
                  ] as const
                ).map(([val, label, desc]) => {
                  const locked = hasFirmInvite
                  const isSelected = role === val
                  const isDisabled = locked && val !== 'advisor'
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!locked) setRole(val)
                      }}
                      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition ${
                        isDisabled ? 'cursor-not-allowed opacity-50' : ''
                      } ${
                        isSelected
                          ? 'border-[color:var(--mwm-navy)] bg-[var(--mwm-navy)] text-white shadow-sm dark:border-[color:var(--mwm-navy)] dark:bg-[var(--mwm-navy)]'
                          : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100'
                      }`}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="mt-0.5 text-xs opacity-70">{desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked)
                  if (e.target.checked) setTermsError(false)
                }}
                className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-neutral-300 accent-[color:var(--mwm-navy)]"
              />
              <span className="text-sm text-neutral-600 dark:text-zinc-400">
                I am at least 18 years old, a United States resident, and I
                agree to the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--mwm-navy)] underline underline-offset-2 hover:text-[color:var(--mwm-gold)] dark:text-indigo-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--mwm-navy)] underline underline-offset-2 hover:text-[color:var(--mwm-gold)] dark:text-indigo-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            {termsError && (
              <p className="ml-7 text-xs text-red-600 dark:text-red-400">
                You must confirm you are 18+, a U.S. resident, and accept our
                Terms and Privacy Policy.
              </p>
            )}
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !termsAccepted}
            variant="primary"
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium shadow-sm"
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-zinc-400">
          Already have an account?{' '}
          <a
            href="/login"
            className="font-medium text-[color:var(--mwm-navy)] underline-offset-4 hover:text-[color:var(--mwm-navy)] hover:underline dark:text-[color:var(--mwm-text-muted)] dark:hover:text-indigo-300"
          >
            Sign in
          </a>
        </p>
      </Card>
    </div>
  )
}
