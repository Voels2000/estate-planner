'use client'

import { RouteErrorFallback } from '@/app/(dashboard)/_components/RouteErrorFallback'

export default function ScenariosError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  void error
  return <RouteErrorFallback title="Unable to load Scenarios" reset={reset} />
}
