export default function AssetsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-pulse">
      <div className="h-8 w-40 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-72 max-w-full rounded bg-neutral-100" />
      <div className="mt-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading assets…</p>
    </div>
  )
}
