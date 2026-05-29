export default function ProjectionsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 animate-pulse">
      <div className="h-8 w-44 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-neutral-100" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="h-3 w-24 rounded bg-neutral-200" />
            <div className="mt-3 h-7 w-32 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-20 rounded-lg bg-neutral-100" />
        ))}
      </div>
      <div className="mt-4 h-80 rounded-xl border border-neutral-200 bg-white" />
      <p className="mt-4 text-sm text-neutral-500">Loading Projections…</p>
    </div>
  )
}
