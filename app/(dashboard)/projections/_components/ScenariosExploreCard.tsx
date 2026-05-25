import Link from 'next/link'

export function ScenariosExploreCard() {
  return (
    <div className="mb-8 rounded-xl border border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)]/80 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--mwm-navy)]">Compare what-if assumptions</p>
        <p className="mt-1 text-xs text-[color:var(--mwm-navy)]/90">
          Test earlier retirement, a different state, or higher growth — side by side with your base case.
        </p>
      </div>
      <Link
        href="/scenarios"
        className="mt-3 inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--mwm-navy-light)] transition sm:mt-0"
      >
        Open Scenarios →
      </Link>
    </div>
  )
}
