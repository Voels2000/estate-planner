'use client'

export function AdvisorSignOut() {
  async function handleSignOut() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
    >
      🚪 Sign out
    </button>
  )
}
