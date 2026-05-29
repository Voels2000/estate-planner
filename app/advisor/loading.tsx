export default function AdvisorLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse">
      <div className="h-8 w-56 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-neutral-100" />
      <div className="mt-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading advisor portal…</p>
    </div>
  )
}
