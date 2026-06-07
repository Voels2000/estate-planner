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
    <div className="min-h-screen bg-neutral-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-neutral-200">
        <div>
          <h1 className="text-lg font-bold text-neutral-900">Attorney Portal</h1>
          <p className="text-xs text-neutral-500">Read-only client data · you upload documents</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500 hidden sm:inline">{user.email}</span>
          <AttorneySignOut />
        </div>
      </div>
      <AttorneyNav pendingRequestCount={pendingRequestCount} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
