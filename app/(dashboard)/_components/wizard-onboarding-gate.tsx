'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const EXEMPT_PREFIXES = [
  '/onboarding/wizard',
  '/onboarding/invite-advisor',
  '/profile',
  '/billing',
  '/settings',
  '/login',
]

export function WizardOnboardingGate({ needsWizard }: { needsWizard: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!needsWizard) return
    if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return
    router.replace('/onboarding/wizard')
  }, [needsWizard, pathname, router])

  return null
}
