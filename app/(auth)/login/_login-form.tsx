'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass, formLabelClass } from '@/components/ui/form'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, subscription_status, firm_role, is_superuser')
        .eq('id', data.user.id)
        .single()

      if (profile?.is_superuser) {
        router.push(redirectTo)
        router.refresh()
        return
      }

      if (profile?.role === 'attorney') {
        router.push('/attorney')
        router.refresh()
      } else if (profile?.role === 'advisor') {
        if (profile?.firm_role === 'member') {
          router.push('/advisor')
          router.refresh()
        } else {
          const hasActiveSub = ['active', 'trialing', 'canceling'].includes(
            profile?.subscription_status ?? ''
          )
          if (hasActiveSub) {
            router.push('/advisor')
            router.refresh()
          } else {
            router.push('/billing')
            router.refresh()
          }
        }
      } else {
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
          Welcome back. Enter your details to access your estate planner.
        </p>

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
              className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
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
            href="/signup"
            className="font-medium text-indigo-600 underline-offset-4 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Create one
          </a>
        </p>
      </Card>
    </div>
  )
}
