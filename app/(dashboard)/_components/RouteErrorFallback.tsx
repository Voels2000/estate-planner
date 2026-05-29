'use client'

export function RouteErrorFallback({
  title,
  reset,
}: {
  title: string
  reset: () => void
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <span className="text-xl text-red-500">!</span>
      </div>
      <p className="mb-1 text-sm font-medium text-gray-700">{title}</p>
      <p className="mb-4 max-w-xs text-xs text-gray-400">
        There was a problem loading this page. Your data is safe.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-[#0F1B3C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0F1B3C]/90"
      >
        Try again
      </button>
    </div>
  )
}
