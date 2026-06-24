import Link from 'next/link'
import { Card } from '@/components/ui/Card'

const MESSAGES: Record<string, { title: string; body: string }> = {
  missing: {
    title: 'Confirmation link incomplete',
    body: 'This link is missing required information. Try signing up again or request a new email.',
  },
  invalid: {
    title: 'Confirmation link expired or already used',
    body: 'This link may have expired, already been used, or been opened by a mail scanner before you could confirm. Request a new confirmation email and click the button promptly.',
  },
}

export default async function ConfirmErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const message = MESSAGES[reason ?? ''] ?? {
    title: 'Could not confirm your email',
    body: 'Something went wrong. Try again or contact support if the problem continues.',
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-2xl p-8 text-center shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-zinc-50">{message.title}</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">{message.body}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/auth/confirm-email"
            className="text-sm font-medium text-[color:var(--mwm-navy)] underline-offset-4 hover:underline"
          >
            Resend confirmation email
          </Link>
          <Link
            href="/signup"
            className="text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Sign up again
          </Link>
        </div>
      </Card>
    </div>
  )
}
