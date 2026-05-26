'use client'

/**
 * Advisor sign-out action button.
 *
 * Executes Supabase auth sign-out and redirects to login.
 */

import { useState } from 'react'

export function AdvisorSignOut() {
  const [isLoading, setIsLoading] = useState(false)

  async function handleSignOut() {
    setIsLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      window.location.href = '/login'
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={isLoading}
      className="text-sm font-medium text-white/70 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Signing out…' : '🚪 Sign out'}
    </button>
  )
}
