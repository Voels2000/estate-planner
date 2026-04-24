import Link from 'next/link'

export default function ConfirmEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg className="h-6 w-6 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Check your email
        </h1>

        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          We sent a confirmation link to your email address. Click the link to activate your account and get started.
        </p>

        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">
          Didn&apos;t receive it? Check your spam folder, or{' '}
          <Link
            href="/signup"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            try signing up again
          </Link>
          .
        </p>

        <div className="mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            Already confirmed?{' '}
            <Link
              href="/login"
              className="font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
            >
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
