import Link from 'next/link'

export default function ClaimListingIdentityMismatchPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="max-w-md px-4 text-center">
        <div className="mb-4 text-5xl">✉️</div>
        <h1 className="text-2xl font-bold text-neutral-900">Email doesn&apos;t match this listing</h1>
        <p className="mt-2 text-neutral-500">
          Sign in with a firm email that matches this listing, or the exact address we emailed
          this link to. If you need help, contact{' '}
          <a
            href="mailto:support@mywealthmaps.com"
            className="text-blue-600 underline"
          >
            support@mywealthmaps.com
          </a>
          .
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Sign in with a different account
        </Link>
      </div>
    </div>
  )
}
