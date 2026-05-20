'use client'

import { useEffect } from 'react'

/**
 * Fire-and-forget funnel event capture.
 * Never throws — analytics failure must never affect UX.
 */
export function captureFunnelEvent(params: {
  event_name: string
  event_slug?: string
  referral_code?: string
  source_url?: string
  properties?: Record<string, unknown>
}) {
  if (typeof window === 'undefined') return

  const referral_code =
    params.referral_code ??
    sessionStorage.getItem('mwm_referral_code') ??
    undefined

  fetch('/api/analytics/funnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      referral_code,
      source_url: params.source_url ?? window.location.href,
    }),
  }).catch(() => {})
}

/**
 * React hook version — fires once on mount.
 */
export function useFunnelEvent(params: Parameters<typeof captureFunnelEvent>[0]) {
  useEffect(() => {
    captureFunnelEvent(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
