import Link from 'next/link'
import type { ProjectionMissingField } from '@/lib/planning/projectionReadiness'
import { PROJECTION_FIELD_LABELS } from '@/lib/planning/projectionReadiness'

type ProjectionEmptyStateProps =
  | {
      missingFields: ProjectionMissingField[]
      title?: never
      description?: never
      actions?: never
    }
  | {
      missingFields?: never
      title: string
      description?: string
      actions?: Array<{
        href: string
        label: string
      }>
    }

export function ProjectionEmptyState(props: ProjectionEmptyStateProps) {
  if (props.missingFields) {
    const { missingFields } = props
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 px-6 text-center">
          <div className="mb-4 text-4xl">📊</div>
          <h2 className="mb-2 text-xl font-semibold text-[color:var(--mwm-navy)]">
            Add a few more details to see your projections
          </h2>
          <p className="mb-6 max-w-md text-sm text-neutral-500">
            To generate retirement projections, we need{' '}
            {missingFields.map((f, i) => (
              <span key={f}>
                {i > 0 && i === missingFields.length - 1 ? ' and ' : i > 0 ? ', ' : ''}
                <strong>{PROJECTION_FIELD_LABELS[f]}</strong>
              </span>
            ))}
            .
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {missingFields.includes('birth_year') || missingFields.includes('retirement_age') ? (
              <Link
                href="/profile"
                className="rounded-md bg-[color:var(--mwm-navy)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Complete your profile →
              </Link>
            ) : null}
            {missingFields.includes('income_or_assets') ? (
              <>
                <Link
                  href="/income"
                  className="rounded-md border border-[color:var(--mwm-navy)] px-5 py-2.5 text-sm font-medium text-[color:var(--mwm-navy)] transition-colors hover:bg-neutral-50"
                >
                  Add income sources →
                </Link>
                <Link
                  href="/assets"
                  className="rounded-md border border-[color:var(--mwm-navy)] px-5 py-2.5 text-sm font-medium text-[color:var(--mwm-navy)] transition-colors hover:bg-neutral-50"
                >
                  Add assets →
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const { title, description, actions = [] } = props

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <div className="mb-3 text-4xl">📈</div>
        <p className="text-sm font-medium text-neutral-600">{title}</p>
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
        {actions.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="text-sm text-[color:var(--mwm-navy)] hover:underline"
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
