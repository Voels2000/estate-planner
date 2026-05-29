'use client'

import { RouteErrorFallback } from '@/app/(dashboard)/_components/RouteErrorFallback'

export default function SocialSecurityError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  void error
  return <RouteErrorFallback title="Unable to load Social Security" reset={reset} />
}
