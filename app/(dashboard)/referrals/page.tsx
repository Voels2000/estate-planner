import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { ReferralsClient } from './_referrals-client'

type SearchParams = { attorneyId?: string | string[] }

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { user, isSuperuser } = await getAccessContext()
  if (!user) redirect('/login')
  if (!isSuperuser) {
    // consumer-only gate: none (links are consumer-facing; layout enforces access)
  }

  const supabase = await createClient()

  const params = await searchParams
  const rawId = params.attorneyId
  const attorneyId = Array.isArray(rawId) ? rawId[0] : rawId

  let attorney: Record<string, unknown> | null = null
  if (attorneyId) {
    const { data } = await supabase
      .from('attorney_listings')
      .select('*')
      .eq('id', attorneyId)
      .eq('is_active', true)
      .maybeSingle()
    attorney = data
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  return (
    <ReferralsClient
      attorney={attorney}
      userName={profile?.full_name ?? ''}
      userEmail={profile?.email ?? user.email ?? ''}
    />
  )
}
