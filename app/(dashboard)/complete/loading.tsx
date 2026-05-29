export default function CompleteLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 animate-pulse">
      <div className="h-8 w-56 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-neutral-100" />
      <div className="mt-6 flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-lg bg-neutral-100" />
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-4 py-3 flex gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 w-20 rounded bg-neutral-200" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-b border-neutral-50 px-4 py-3 flex gap-4">
            {[...Array(6)].map((_, j) => (
              <div key={j} className="h-3 flex-1 rounded bg-neutral-100" />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading Lifetime Snapshot…</p>
    </div>
  )
}
