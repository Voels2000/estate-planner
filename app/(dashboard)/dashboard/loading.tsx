export default function LoadingMyEstatePlan() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 animate-pulse">
      <div className="h-8 w-56 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-neutral-100" />
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-28 rounded-xl border border-neutral-200 bg-white" />
        <div className="h-28 rounded-xl border border-neutral-200 bg-white" />
        <div className="h-28 rounded-xl border border-neutral-200 bg-white" />
      </div>
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="h-5 w-40 rounded bg-neutral-200" />
        <div className="mt-4 h-48 rounded bg-neutral-100" />
      </div>
      <p className="mt-4 text-sm text-neutral-500">Loading My Estate Plan...</p>
    </div>
  )
}
