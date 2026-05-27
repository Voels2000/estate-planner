import Link from 'next/link'

type MwmWordmarkProps = {
  href?: string
  className?: string
}

export function MwmWordmark({ href = '/', className = '' }: MwmWordmarkProps) {
  const mark = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--mwm-gold)] font-[family-name:var(--font-playfair)] text-sm font-semibold text-[color:var(--mwm-navy)]"
        aria-hidden
      >
        M
      </span>
      <span className="font-[family-name:var(--font-playfair)] text-base font-medium tracking-wide text-[color:var(--mwm-navy)]">
        My Wealth Maps
      </span>
    </span>
  )

  if (href) {
    return (
      <Link href={href} className="no-underline hover:opacity-90">
        {mark}
      </Link>
    )
  }

  return mark
}
