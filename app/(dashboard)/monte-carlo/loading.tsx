export default function MonteCarloLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 animate-pulse">
      <div className="h-8 w-56 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-full max-w-lg rounded bg-neutral-100" />
      <div className="mt-6 flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-lg bg-neutral-100" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="h-4 w-32 rounded bg-neutral-200" />
          <div className="mt-4 h-8 w-full rounded bg-neutral-100" />
        </div>
        <div className="h-40 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="h-4 w-28 rounded bg-neutral-200" />
          <div className="mt-4 h-8 w-full rounded bg-neutral-100" />
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mx-auto h-36 w-36 rounded-full bg-neutral-100" />
        <div className="mt-6 h-48 rounded-lg bg-neutral-100" />
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading Monte Carlo…</p>
    </div>
  )
}
