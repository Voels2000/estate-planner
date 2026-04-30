export function EducationMetaBadges({
  pillarLabel,
  complexity,
  estimatedTime,
}: {
  pillarLabel: string
  complexity: string
  estimatedTime: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {pillarLabel ? (
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-900 ring-1 ring-indigo-100">
          {pillarLabel}
        </span>
      ) : null}
      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium capitalize text-neutral-800 ring-1 ring-neutral-200/80">
        {complexity}
      </span>
      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-neutral-600 ring-1 ring-neutral-200">
        {estimatedTime}
      </span>
    </div>
  )
}
