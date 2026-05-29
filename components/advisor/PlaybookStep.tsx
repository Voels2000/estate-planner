'use client'

interface PlaybookStepProps {
  number: number
  title: string
  description: string
  href: string
  completed: boolean
  ctaLabel: string
}

export function PlaybookStep({
  number,
  title,
  description,
  href,
  completed,
  ctaLabel,
}: PlaybookStepProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
        completed ? 'bg-emerald-50' : 'bg-white'
      }`}
    >
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
          completed ? 'bg-emerald-500 text-white' : 'bg-[color:var(--mwm-navy)] text-white'
        }`}
      >
        {completed ? '✓' : number}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold ${
            completed ? 'text-emerald-700 line-through' : 'text-[color:var(--mwm-navy)]'
          }`}
        >
          {title}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
        {!completed && (
          <a
            href={href}
            className="text-xs font-semibold text-[color:var(--mwm-navy)] underline mt-1 inline-block"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  )
}
