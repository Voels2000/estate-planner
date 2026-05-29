export default function TitlingLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse">
      <div className="h-8 w-48 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-neutral-100" />
      <div className="mt-6 flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-lg bg-neutral-100" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading titling & beneficiaries…</p>
    </div>
  )
}
