type Props = {
  score: number | null
  computedAt: string | null
  clientName: string | null
}

const LEVEL_CONFIG = {
  strong: { label: 'Strong', color: '#4a7c6f', bg: '#eef6f4', border: '#a8d5c8', min: 80 },
  developing: { label: 'Developing', color: '#ba7517', bg: '#faeeda', border: '#f5cc7a', min: 60 },
  attention: { label: 'Needs Attention', color: '#c9a84c', bg: '#fdf6e3', border: '#e8c97a', min: 40 },
  action: { label: 'Action Required', color: '#d85a30', bg: '#fef3ee', border: '#f9c5a1', min: 0 },
}

function getLevel(score: number) {
  if (score >= 80) return LEVEL_CONFIG.strong
  if (score >= 60) return LEVEL_CONFIG.developing
  if (score >= 40) return LEVEL_CONFIG.attention
  return LEVEL_CONFIG.action
}

export function PlanReadinessCard({ score, computedAt, clientName }: Props) {
  if (score === null) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
          Plan Readiness
        </p>
        <p className="text-sm text-neutral-500">
          No readiness score yet.{' '}
          {clientName ? `${clientName} hasn't` : "Client hasn't"} completed
          enough of their profile to generate a score.
        </p>
      </div>
    )
  }

  const level = getLevel(score)

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: level.bg, borderColor: level.border }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: level.color }}
        >
          Plan Readiness Score
        </p>
        {computedAt && (
          <p className="text-xs text-neutral-400">
            Updated{' '}
            {new Date(computedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className="text-4xl font-bold" style={{ color: level.color }}>
          {score}
        </span>
        <span className="text-sm mb-1" style={{ color: level.color }}>
          / 100
        </span>
        <span
          className="mb-1 text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: 'white',
            color: level.color,
            border: `1px solid ${level.border}`,
          }}
        >
          {level.label}
        </span>
      </div>

      <div className="h-2 rounded-full bg-white/60 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${score}%`,
            background: level.color,
          }}
        />
      </div>

      <p className="text-xs leading-relaxed" style={{ color: level.color }}>
        {score >= 80
          ? `${clientName ?? 'Client'}'s plan is well-organized. Review for any remaining gaps before your next meeting.`
          : score >= 60
            ? `${clientName ?? 'Client'}'s plan has room to improve. Use your next meeting to address the open items.`
            : score >= 40
              ? `${clientName ?? 'Client'}'s plan needs attention. Several key planning areas are incomplete.`
              : `${clientName ?? 'Client'}'s plan has significant gaps. Prioritize a planning review meeting.`}
      </p>
    </div>
  )
}
