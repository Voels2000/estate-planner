export default function ScenariosLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="h-8 w-40 rounded bg-neutral-200" />
          <div className="mt-3 h-4 w-96 max-w-full rounded bg-neutral-100" />
        </div>
        <div className="h-9 w-64 rounded-lg bg-neutral-100" />
      </div>
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="h-5 w-48 rounded bg-neutral-200" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-neutral-100" />
          ))}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 rounded-2xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-2xl border border-neutral-200 bg-white" />
      <p className="mt-4 text-sm text-neutral-500">Loading Scenarios…</p>
    </div>
  )
}
