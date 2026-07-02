import Link from "next/link"

export default function ClaimListingAlreadyClaimedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="max-w-md px-4 text-center">
        <div className="mb-4 text-5xl">⚠️</div>
        <h1 className="text-2xl font-bold text-neutral-900">Already Claimed</h1>
        <p className="mt-2 text-neutral-500">
          This listing has already been claimed by another advisor account.
        </p>
        <Link
          href="/advisor"
          className="mt-6 inline-block rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Go to Advisor Portal
        </Link>
      </div>
    </div>
  )
}
