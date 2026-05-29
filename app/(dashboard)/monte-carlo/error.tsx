'use client'

import { RouteErrorFallback } from '@/app/(dashboard)/_components/RouteErrorFallback'

export default function MonteCarloError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  void error
  return <RouteErrorFallback title="Unable to load Monte Carlo" reset={reset} />
}
