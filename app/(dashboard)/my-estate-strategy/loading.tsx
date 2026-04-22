export default function LoadingMyEstateStrategy() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 animate-pulse">
      <div className="h-8 w-64 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-neutral-100" />
      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="h-5 w-48 rounded bg-neutral-200" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-32 rounded bg-neutral-100" />
          <div className="h-32 rounded bg-neutral-100" />
          <div className="h-32 rounded bg-neutral-100" />
          <div className="h-32 rounded bg-neutral-100" />
        </div>
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading My Estate Strategy...</p>
    </div>
  )
}
