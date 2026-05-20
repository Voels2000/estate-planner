'use client'

import { useEffect } from 'react'

export function ReferralTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (!ref) return
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
  }, [slug])

  return null
}
