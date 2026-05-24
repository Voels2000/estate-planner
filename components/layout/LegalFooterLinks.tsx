import Link from 'next/link'

type Props = {
  className?: string
  linkClassName?: string
}

export function LegalFooterLinks({ className = '', linkClassName = '' }: Props) {
  const linkStyles =
    linkClassName ||
    'text-inherit underline-offset-4 hover:underline'

  return (
    <nav aria-label="Legal" className={className}>
      <Link href="/privacy" className={linkStyles}>
        Privacy Policy
      </Link>
      <span className="mx-2 opacity-60" aria-hidden>
        ·
      </span>
      <Link href="/terms" className={linkStyles}>
        Terms of Service
      </Link>
    </nav>
  )
}
