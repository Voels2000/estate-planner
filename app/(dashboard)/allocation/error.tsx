'use client'

import { RouteErrorFallback } from '@/app/(dashboard)/_components/RouteErrorFallback'

export default function AllocationError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  void error
  return <RouteErrorFallback title="Unable to load Asset Allocation" reset={reset} />
}
