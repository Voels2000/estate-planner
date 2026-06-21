import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { createClient } from '@/lib/supabase/server'
import { AttorneySignOut } from './_components/attorney-sign-out'
import { AttorneyNav } from './_components/attorney-nav'

export default async function AttorneyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAttorney } = await getAccessContext()

  if (!user) redirect('/login')
  if (!isAttorney) redirect('/dashboard')

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('attorney_listings')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  let pendingRequestCount = 0
  if (listing?.id) {
    const { count } = await supabase
      .from('attorney_clients')
      .select('id', { count: 'exact', head: true })
      .eq('attorney_id', listing.id)
      .eq('status', 'consumer_requested')
    pendingRequestCount = count ?? 0
  }

  return (
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      <nav className="flex items-center justify-between border-b border-[color:var(--mwm-navy)]/20 bg-[color:var(--mwm-navy)] px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold tracking-wide text-white">My Wealth Maps</span>
          <span className="rounded-full border border-[color:var(--mwm-gold)]/40 bg-[color:var(--mwm-gold)]/20 px-2.5 py-0.5 text-xs font-medium text-[color:var(--mwm-gold)]">
            Attorney Portal
          </span>
          <span className="hidden text-xs text-white/60 sm:inline">
            Read-only client data · you upload documents
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-white/70 hover:text-white hover:underline"
          >
            📜 My Estate Plan
          </Link>
          <span className="hidden text-sm text-white/60 sm:inline">{user.email}</span>
          <Link
            href="/attorney/settings"
            className="text-sm font-medium text-white/70 hover:text-white hover:underline"
          >
            Profile ⚙️
          </Link>
          <AttorneySignOut />
        </div>
      </nav>
      <div className="bg-white">
        <div className="mx-auto max-w-7xl px-4 pt-2">
          <AttorneyNav pendingRequestCount={pendingRequestCount} />
        </div>
      </div>
      <main className="mx-auto max-w-7xl flex-1 px-4 pb-10 pt-4">{children}</main>
    </div>
  )
}
