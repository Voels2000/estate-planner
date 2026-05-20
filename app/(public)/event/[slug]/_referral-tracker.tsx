'use client'

import { useEffect } from 'react'
import { captureFunnelEvent } from '@/lib/analytics/useFunnelEvent'

export function ReferralTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      sessionStorage.setItem('mwm_referral_code', ref)
      sessionStorage.setItem('mwm_referral_slug', slug)
      fetch('/api/referral/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref,
          event_slug: slug,
          source_url: window.location.href,
        }),
      }).catch(() => {})
    }

    captureFunnelEvent({
      event_name: 'event_page_view',
      event_slug: slug,
      referral_code: ref ?? undefined,
    })
  }, [slug])

  return null
}
