export default function TrustStrategyLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-2 h-8 w-64 rounded bg-gray-100" />
      <div className="mb-6 h-4 w-96 max-w-full rounded bg-gray-100" />
      <div className="mb-6 flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-32 rounded-full bg-gray-100" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-32 rounded-xl bg-gray-100" />
        <div className="h-48 rounded-xl bg-gray-100" />
      </div>
    </div>
  )
}
