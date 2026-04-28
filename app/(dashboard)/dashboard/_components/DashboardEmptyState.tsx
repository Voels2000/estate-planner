import Link from 'next/link'

export function DashboardEmptyState() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <div className="text-4xl mb-3">🏡</div>
        <p className="text-sm font-medium text-neutral-700">My Estate Plan is not set up yet</p>
        <p className="mt-1 text-xs text-neutral-500">
          We could not find a household profile for this account. Complete your profile to create your estate plan workspace.
        </p>
        <div className="mt-4">
          <Link href="/profile" className="text-sm text-indigo-600 hover:underline">
            Complete profile setup →
          </Link>
        </div>
      </div>
    </div>
  )
}
