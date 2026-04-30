export function EducationMetaBadges({
  pillarLabel,
  complexity,
  estimatedTime,
}: {
  pillarLabel: string
  complexity: string
  estimatedTime: string
}) {
  const complexityClass =
    complexity === 'foundation'
      ? 'c-foundation'
      : complexity === 'intermediate'
        ? 'c-intermediate'
        : complexity === 'advanced'
          ? 'c-advanced'
          : ''

  return (
    <div className="flex flex-wrap gap-2">
      {pillarLabel ? (
        <span className="meta-chip">
          {pillarLabel}
        </span>
      ) : null}
      <span className={`meta-chip capitalize ${complexityClass}`.trim()}>
        {complexity}
      </span>
      <span className="meta-chip">
        {estimatedTime}
      </span>
    </div>
  )
}
