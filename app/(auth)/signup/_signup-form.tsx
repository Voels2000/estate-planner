'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// FIX: canonical role values — 'advisor' not 'financial_advisor'
type Role = 'consumer' | 'advisor' | 'attorney'

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [fullName, setFullName] = useState('')
  const inviteEmail = searchParams.get('email') || ''
  const advisorInviteToken = searchParams.get('invite') || ''
  const hasAdvisorInvite = advisorInviteToken !== ''
  const firmInviteToken = searchParams.get('invite_token')?.trim() ?? ''
  const firmIdParam = searchParams.get('firm_id')?.trim() ?? ''
  const hasFirmInvite = firmInviteToken !== '' && firmIdParam !== ''

  const [email, setEmail] = useState(inviteEmail)
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(
    hasFirmInvite && !hasAdvisorInvite ? 'advisor' : 'consumer',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const effectiveRole: Role = hasAdvisorInvite ? 'consumer' : role

      const callbackUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback${
              hasFirmInvite
                ? `?invite_token=${encodeURIComponent(firmInviteToken)}&firm_id=${encodeURIComponent(firmIdParam)}`
                : ''
            }`
          : undefined

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: effectiveRole },
          emailRedirectTo: callbackUrl,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsSubmitting(false)
        return
      }

      if (data.user?.identities && data.user.identities.length === 0) {
        setError('An account with this email already exists.')
        setIsSubmitting(false)
        return
      }

      if (effectiveRole === 'advisor' && data.user && !hasFirmInvite) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, firm_id')
            .eq('id', data.user.id)
            .maybeSingle()

          if (profile?.role === 'advisor' && profile.firm_id == null) {
            const userEmail = data.user.email ?? email
            const prefix = userEmail.includes('@')
              ? userEmail.slice(0, userEmail.indexOf('@')).trim()
              : userEmail.trim() || 'Advisor'
            const defaultFirmName = `${prefix} Firm`

            const { data: newFirm, error: firmError } = await supabase
              .from('firms')
              .insert({
                name: defaultFirmName,
                owner_id: data.user.id,
                tier: 'starter',
                seat_count: 1,
                subscription_status: null,
              })
              .select('id')
              .single()

            if (firmError) throw firmError
            if (!newFirm?.id) throw new Error('firm insert returned no id')

            const { error: memberError } = await supabase.from('firm_members').insert({
              firm_id: newFirm.id,
              user_id: data.user.id,
              firm_role: 'owner',
              status: 'active',
              joined_at: new Date().toISOString(),
            })
            if (memberError) throw memberError

            const { error: profileError } = await supabase
              .from('profiles')
              .update({ firm_id: newFirm.id, firm_role: 'owner' })
              .eq('id', data.user.id)
            if (profileError) throw profileError
          }
        } catch (err) {
          console.error('advisor firm bootstrap error:', err)
        }
      }

      if (hasFirmInvite) {
        void fetch('/api/firm/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invite_token: firmInviteToken,
            firm_id: firmIdParam,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              console.error('firm join after signup:', await res.text().catch(() => res.status))
            }
          })
          .catch((err) => {
            console.error('firm join after signup:', err)
          })
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('Sign-in after signup failed:', signInError.message)
        // Still attempt link — non-fatal
      }

      // Auto-link to any advisor who invited this email
      await fetch('/api/advisor/link-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken: advisorInviteToken }),
      })

      // Fire welcome email
      await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName: fullName.split(' ')[0] || 'there' }),
      })

      // Route based on role after signup.
      setIsDone(true)
      if (effectiveRole === 'advisor' && hasFirmInvite) {
        router.push('/advisor')
      } else if (effectiveRole === 'advisor') {
        router.push('/billing')
      } else if (effectiveRole === 'attorney') {
        router.push('/attorney')
      } else {
        // New consumers always go to /profile first to set up household.
        // Advisor-invited clients skip /billing (advisor_managed after link-pending).
        router.push('/profile')
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Full-screen loading overlay while navigating
  if (isDone) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 gap-4">
        <svg className="h-8 w-8 animate-spin text-zinc-900 dark:text-zinc-50" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Setting up your account…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Get started with your estate planning workspace.
        </p>

        {hasAdvisorInvite && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            👋 Your financial advisor has invited you to MyWealthMaps. Create your account to get
            started — no subscription required.
          </div>
        )}

        {hasFirmInvite && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200">
            🏢 You&apos;ve been invited to join a firm on MyWealthMaps. Complete your signup to accept.
          </div>
        )}

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="Jane Doe"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
              className={`block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:text-zinc-50 ${
                hasAdvisorInvite
                  ? 'cursor-not-allowed bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400'
                  : 'bg-white dark:bg-zinc-950'
              }`}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="At least 6 characters"
            />
          </div>

          {hasAdvisorInvite ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              You&apos;re signing up as a client. Your advisor will manage your access.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Role</p>
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
                          ? 'border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                          : 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100'
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

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-700 active:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
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
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
