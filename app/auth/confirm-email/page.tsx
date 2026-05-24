'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function ConfirmEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')?.trim() ?? ''
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)

  async function handleResend() {
    if (!email) {
      setResendError('No email address on file. Please sign up again.')
      return
    }
    setIsResending(true)
    setResendMessage(null)
    setResendError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setResendError(error.message)
      } else {
        setResendMessage('Confirmation email sent. Check your inbox.')
      }
    } catch {
      setResendError('Something went wrong. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans dark:bg-zinc-950">
      <Card className="w-full max-w-md rounded-2xl p-8 text-center shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="text-4xl mb-4">📬</div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
          We sent a confirmation link to{' '}
          {email ? (
            <strong>{email}</strong>
          ) : (
            'your email address'
          )}
          . Click it to activate your account.
        </p>

        <div className="mt-6 space-y-3">
          <Button
            type="button"
            variant="primary"
            disabled={isResending || !email}
            onClick={handleResend}
            className="w-full rounded-lg py-2.5 text-sm font-medium shadow-sm"
          >
            {isResending ? 'Sending…' : 'Resend confirmation email'}
          </Button>

          {resendMessage && (
            <p className="text-sm text-green-600 dark:text-green-400">{resendMessage}</p>
          )}
          {resendError && (
            <p className="text-sm text-red-600 dark:text-red-400">{resendError}</p>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-zinc-400">
          Wrong email?{' '}
          <a
            href="/signup"
            className="font-medium text-indigo-600 underline-offset-4 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Sign up again
          </a>
        </p>
      </Card>
    </div>
  )
}

function ConfirmEmailFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="h-9 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700 mx-auto" />
        <div className="mt-4 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 mx-auto" />
      </div>
    </div>
  )
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<ConfirmEmailFallback />}>
      <ConfirmEmailContent />
    </Suspense>
  )
}
