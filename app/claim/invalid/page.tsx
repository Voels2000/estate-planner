import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export default function InvalidClaimPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Invalid claim link</h1>
        <p className="mt-3 text-sm text-neutral-600">
          This link may have expired or already been used. If you received a directory outreach email,
          reply to it or contact{' '}
          <a href="mailto:support@mywealthmaps.com" className="text-blue-600 underline">
            support@mywealthmaps.com
          </a>{' '}
          for a fresh link.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-blue-600 underline">
          Back to home
        </Link>
      </Card>
    </div>
  )
}
