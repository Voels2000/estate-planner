'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { captureFunnelEvent } from '@/lib/analytics/useFunnelEvent'
import {
  BETA_SIGNUP_ACCESS_LABEL_PARAM,
  BETA_SIGNUP_ACCESS_PARAM,
  BETA_SIGNUP_FUNNEL_VIEW_EVENT,
} from '@/lib/waitlist-mode'

type Props = {
  /** Server confirmed beta access (token or cookie) — fires view event once per mount when URL has `access`. */
  betaAccessActive: boolean
  /** Label from URL or persisted cookie (cohort name). */
  betaLabel?: string | null
}

/** Logs `beta_signup_link_viewed` when someone lands on signup via a private access link. */
export function BetaSignupViewTracker({ betaAccessActive, betaLabel }: Props) {
  const searchParams = useSearchParams()
  const accessInUrl = searchParams.get(BETA_SIGNUP_ACCESS_PARAM)

  useEffect(() => {
    if (!betaAccessActive || !accessInUrl) return

    const label =
      searchParams.get(BETA_SIGNUP_ACCESS_LABEL_PARAM)?.trim() || betaLabel || undefined

    captureFunnelEvent({
      event_name: BETA_SIGNUP_FUNNEL_VIEW_EVENT,
      properties: label ? { label } : {},
    })
  }, [betaAccessActive, accessInUrl, betaLabel, searchParams])

  return null
}
