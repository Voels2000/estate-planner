import { confirmSignup } from './actions'
import { ConfirmButton } from './ConfirmButton'
import { Card } from '@/components/ui/Card'

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>
}) {
  const { token_hash, type } = await searchParams
  const valid = Boolean(token_hash) && type === 'signup'

  if (!valid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-2xl p-8 text-center shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-zinc-50">
            This confirmation link is invalid
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
            The link may be malformed. Try signing up again or request a new email from the
            confirm-email page.
          </p>
          <a
            href="/signup"
            className="mt-6 inline-block text-sm font-medium text-[color:var(--mwm-navy)] underline-offset-4 hover:underline"
          >
            Back to sign up
          </a>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-2xl p-8 text-center shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="text-4xl mb-4">✉️</div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-zinc-50">
          Confirm your email
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
          Click below to activate your My Wealth Maps account. This step protects your account from
          automated link scanners.
        </p>

        <form action={confirmSignup} className="mt-4">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <ConfirmButton />
        </form>
      </Card>
    </div>
  )
}
