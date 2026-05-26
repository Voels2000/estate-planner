'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isWizardGateExemptPath } from '@/lib/onboarding/wizardGateExemptPrefixes'

export function WizardOnboardingGate({ needsWizard }: { needsWizard: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!needsWizard) return
    if (isWizardGateExemptPath(pathname)) return
    router.replace('/onboarding/wizard')
  }, [needsWizard, pathname, router])

  return null
}
