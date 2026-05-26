import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export type StrategyQuestionNotification = {
  id: string
  title: string
  created_at: string
  metadata: {
    strategy_name?: string
    strategy_type?: string
    plan_url?: string
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - then)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function ClientStrategyQuestionsCard({
  questions,
}: {
  questions: StrategyQuestionNotification[]
}) {
  if (questions.length === 0) return null

  return (
    <Card accent>
      <Card.Header>
        <h3 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--mwm-navy)]">
          Client Strategy Questions
        </h3>
        <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
          Your client asked about a transfer strategy — review their plan and add a recommendation if
          appropriate.
        </p>
      </Card.Header>
      <Card.Body className="divide-y divide-[color:var(--mwm-border)] p-0">
        {questions.map((q) => {
          const strategyLabel = q.metadata.strategy_name ?? q.metadata.strategy_type ?? 'Strategy'
          const planUrl = q.metadata.plan_url ?? '#'
          return (
            <div
              key={q.id}
              className="flex items-start justify-between gap-4 px-6 py-4 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[color:var(--mwm-navy)]">{strategyLabel}</p>
                <p className="mt-0.5 text-xs text-[color:var(--mwm-text-muted)]">
                  {q.title} · {formatRelativeTime(q.created_at)}
                </p>
              </div>
              <Link
                href={planUrl}
                className="whitespace-nowrap text-sm text-[color:var(--mwm-navy)] underline underline-offset-2 hover:text-[color:var(--mwm-navy-light)]"
              >
                View plan →
              </Link>
            </div>
          )
        })}
      </Card.Body>
    </Card>
  )
}
