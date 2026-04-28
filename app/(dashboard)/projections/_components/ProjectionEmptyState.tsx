import Link from 'next/link'

type ProjectionEmptyStateProps = {
  title: string
  description?: string
  actions?: Array<{
    href: string
    label: string
  }>
}

export function ProjectionEmptyState({ title, description, actions = [] }: ProjectionEmptyStateProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <div className="text-4xl mb-3">📈</div>
        <p className="text-sm font-medium text-neutral-600">{title}</p>
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
        {actions.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            {actions.map((action) => (
              <Link key={action.href} href={action.href} className="text-sm text-indigo-600 hover:underline">
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
