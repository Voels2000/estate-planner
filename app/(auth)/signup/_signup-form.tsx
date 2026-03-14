'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'consumer' | 'financial_advisor'

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('consumer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
          emailRedirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsSubmitting(false)
        return
      }

      if (data.user?.identities && data.user.identities.length === 0) {
        // Existing user
        setError('An account with this email already exists.')
        setIsSubmitting(false)
        return
      }

      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Get started with your estate planning workspace in a few steps.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
              placeholder="Jane Doe"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
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
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
              placeholder="Create a strong password"
            />
          </div>

          <div className="space-y-1.5">
            <p className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Role
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRole('consumer')}
                className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition ${
                  role === 'consumer'
                    ? 'border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                    : 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500'
                }`}
              >
                <span className="font-medium">Consumer</span>
                <span className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Manage your own estate planning.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRole('financial_advisor')}
                className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition ${
                  role === 'financial_advisor'
                    ? 'border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                    : 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500'
                }`}
              >
                <span className="font-medium">Financial advisor</span>
                <span className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Support clients with their estate plans.
                </span>
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{' '}
          <a
            href="/(auth)/login"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
