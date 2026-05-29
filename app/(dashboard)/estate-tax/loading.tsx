export default function EstateTaxLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 animate-pulse">
      <div className="h-8 w-52 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-neutral-100" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="h-3 w-24 rounded bg-neutral-200" />
            <div className="mt-4 h-8 w-28 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="h-5 w-40 rounded bg-neutral-200" />
        <div className="mt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-neutral-100" />
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading Estate Tax Snapshot…</p>
    </div>
  )
}
