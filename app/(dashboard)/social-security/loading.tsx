export default function SocialSecurityLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-52 rounded bg-neutral-200" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-neutral-100" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="h-5 w-36 rounded bg-neutral-200" />
            <div className="mt-4 space-y-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-10 rounded-lg bg-neutral-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 h-64 rounded-xl border border-neutral-200 bg-white" />
      <p className="mt-4 text-sm text-neutral-500">Loading Social Security…</p>
    </div>
  )
}
