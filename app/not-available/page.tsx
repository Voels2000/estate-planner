import Link from 'next/link'
import { US_ONLY_SUPPORT_EMAIL } from '@/lib/geo/usOnlyAccess'

export default function NotAvailablePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--mwm-off-white)] px-6 py-16">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Service not available in your region
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          My Wealth Maps is currently available only to United States residents for use with
          United States–based estates.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600">
          If you are a US resident and believe you&apos;re seeing this in error — for example,
          on a corporate VPN — contact us at{' '}
          <a
            href={`mailto:${US_ONLY_SUPPORT_EMAIL}`}
            className="font-medium text-[color:var(--mwm-navy)] underline underline-offset-2"
          >
            {US_ONLY_SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="mt-8">
          <Link
            href="/"
            className="text-sm font-medium text-[color:var(--mwm-navy)] underline underline-offset-2"
          >
            Return to homepage
          </Link>
        </p>
      </div>
    </div>
  )
}
