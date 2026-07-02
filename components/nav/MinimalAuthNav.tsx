import Link from 'next/link'
import { MwmWordmark } from '@/components/nav/MwmWordmark'

type MinimalAuthNavProps = {
  backLabel?: string
  backHref?: string
  logoHref?: string
}

/** Thin nav for authenticated pages outside the dashboard sidebar (e.g. billing). */
export function MinimalAuthNav({
  backLabel = '← My Dashboard',
  backHref = '/dashboard',
  logoHref = '/dashboard',
}: MinimalAuthNavProps) {
  return (
    <header className="border-b border-[color:var(--mwm-border)] bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <MwmWordmark href={logoHref} />
        <Link
          href={backHref}
          className="text-sm text-neutral-500 transition-colors hover:text-[color:var(--mwm-navy)]"
        >
          {backLabel}
        </Link>
      </div>
    </header>
  )
}
