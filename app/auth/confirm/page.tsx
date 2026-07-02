import { confirmMagicLink, confirmSignup } from './actions'
import { ConfirmButton } from './ConfirmButton'
import { Card } from '@/components/ui/Card'

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}) {
  const { token_hash, type, next } = await searchParams
  const isSignup = Boolean(token_hash) && type === 'signup'
  const isClaimMagic =
    Boolean(token_hash) &&
    type === 'magiclink' &&
    typeof next === 'string' &&
    next.startsWith('/claim/')

  if (!isSignup && !isClaimMagic) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-2xl p-8 text-center shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-zinc-50">
            This confirmation link is invalid
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
            The link may be malformed or expired. Try the link from your latest email, or contact{' '}
            <a href="mailto:support@mywealthmaps.com" className="underline">
              support@mywealthmaps.com
            </a>
            .
          </p>
          <a
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-[color:var(--mwm-navy)] underline-offset-4 hover:underline"
          >
            Sign in
          </a>
        </Card>
      </div>
    )
  }

  const formAction = isSignup ? confirmSignup : confirmMagicLink

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-2xl p-8 text-center shadow-sm ring-1 ring-neutral-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="text-4xl mb-4">{isClaimMagic ? '🔗' : '✉️'}</div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-zinc-50">
          {isClaimMagic ? 'Continue to your listing' : 'Confirm your email'}
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-400">
          {isClaimMagic
            ? 'Click below to sign in and open your directory claim page. This one step protects your link from automated email scanners.'
            : 'Click below to activate your My Wealth Maps account. This step protects your account from automated link scanners.'}
        </p>

        <form action={formAction} className="mt-4">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          {isClaimMagic && next ? <input type="hidden" name="next" value={next} /> : null}
          <ConfirmButton label={isClaimMagic ? 'Continue to claim' : undefined} />
        </form>
      </Card>
    </div>
  )
}
