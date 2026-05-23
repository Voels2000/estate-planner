'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const EXEMPT_PREFIXES = ['/onboarding/invite-advisor', '/profile', '/billing', '/login']

export function InviteAdvisorOnboardingGate({ needsOnboarding }: { needsOnboarding: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!needsOnboarding) return
    if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return
    router.replace('/onboarding/invite-advisor')
  }, [needsOnboarding, pathname, router])

  return null
}
