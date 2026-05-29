export default function AllocationLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 animate-pulse">
      <div className="h-8 w-48 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-neutral-100" />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <div className="mx-auto h-40 w-40 rounded-full bg-neutral-100" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full rounded bg-neutral-100" />
            <div className="h-3 w-4/5 rounded bg-neutral-100" />
            <div className="h-3 w-3/5 rounded bg-neutral-100" />
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 rounded bg-neutral-200 mb-2" />
              <div className="h-2 w-full rounded-full bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading Asset Allocation…</p>
    </div>
  )
}
