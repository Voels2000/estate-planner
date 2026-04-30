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
        <span className="education-meta-chip rounded-full px-2.5 py-0.5 text-xs font-medium">
          {pillarLabel}
        </span>
      ) : null}
      <span className="education-meta-chip rounded-full px-2.5 py-0.5 text-xs font-medium capitalize">
        {complexity}
      </span>
      <span className="education-meta-chip rounded-full px-2.5 py-0.5 text-xs">
        {estimatedTime}
      </span>
    </div>
  )
}
