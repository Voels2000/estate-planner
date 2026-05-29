'use client'

import { useEffect, useRef } from 'react'

/**
 * Fallback for advisor→client invites: links a pending invite row after signup/login
 * when email confirmation delayed acceptance of the invite page.
 */
export function LinkPendingInviteOnMount() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    void fetch('/api/advisor/link-pending', { method: 'POST' }).catch(() => {})
  }, [])

  return null
}
