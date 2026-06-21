'use client'

import { useState } from 'react'

export function AttorneySignOut() {
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
      className="text-sm font-medium text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? 'Signing out…' : '🚪 Sign out'}
    </button>
  )
}
