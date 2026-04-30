import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function ConfirmEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans dark:bg-zinc-950">
      <Card className="w-full max-w-md rounded-2xl p-8 text-center shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-zinc-800">
          <svg
            className="h-6 w-6 text-indigo-600 dark:text-zinc-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
          Check your email
        </h1>

        <p className="mt-3 text-sm text-neutral-600 dark:text-zinc-400">
          We sent a confirmation link to your email address. Click the link to activate your account and get started.
        </p>

        <p className="mt-4 text-sm text-neutral-500 dark:text-zinc-500">
          Didn&apos;t receive it? Check your spam folder, or{' '}
          <ButtonLink href="/signup" variant="link" className="font-semibold">
            try signing up again
          </ButtonLink>
          .
        </p>

        <div className="mt-8 border-t border-neutral-100 pt-6 dark:border-zinc-800">
          <p className="text-xs text-neutral-500 dark:text-zinc-600">
            Already confirmed?{' '}
            <ButtonLink href="/login" variant="link" className="font-semibold">
              Sign in
            </ButtonLink>
          </p>
        </div>
      </Card>
    </div>
  )
}
