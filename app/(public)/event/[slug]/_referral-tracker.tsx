'use client'

import { useEffect } from 'react'
import { captureFunnelEvent } from '@/lib/analytics/useFunnelEvent'

/**
 * ReferralTracker — fires on every event page mount.
 *
 * Params read from URL:
 *   ?ref=CODE   → advisor referral (existing behaviour, unchanged)
 *   ?aref=CODE  → attorney referral (Sprint 8)
 *
 * Both are stored in sessionStorage so they survive through signup.
 * Only one POST is fired per page load; attorney takes precedence if both present.
 */
export function ReferralTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref   = params.get('ref')
    const aref  = params.get('aref')

    // ── Advisor referral ─────────────────────────────────────────────────────
    if (ref) {
      sessionStorage.setItem('mwm_referral_code', ref)
      sessionStorage.setItem('mwm_referral_slug', slug)
      fetch('/api/referral/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref,
          type: 'advisor',
          event_slug: slug,
          source_url: window.location.href,
        }),
      }).catch(() => {})
    }

    // ── Attorney referral ────────────────────────────────────────────────────
    if (aref) {
      sessionStorage.setItem('mwm_attorney_referral_code', aref)
      sessionStorage.setItem('mwm_attorney_referral_slug', slug)
      fetch('/api/referral/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: aref,
          type: 'attorney',
          event_slug: slug,
          source_url: window.location.href,
        }),
      }).catch(() => {})
    }

    // ── Funnel event (always fires) ──────────────────────────────────────────
    captureFunnelEvent({
      event_name: 'event_page_view',
      event_slug: slug,
      referral_code: ref ?? aref ?? undefined,
    })
  }, [slug])

  return null
}
