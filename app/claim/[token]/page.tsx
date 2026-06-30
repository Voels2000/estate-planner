import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDirectoryClaimToken } from '@/lib/directory/resolveClaimToken'
import { DirectoryClaimClient } from './_directory-claim-client'

interface Props {
  params: Promise<{ token: string }>
}

export default async function DirectoryClaimPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()
  const target = await resolveDirectoryClaimToken(admin, token)

  if (!target) {
    redirect('/claim/invalid')
  }

  const listing = target.listing
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profileId = listing.profile_id as string | null
  const claimedByYou = !!(user && profileId === user.id)
  const alreadyClaimed = !!(profileId && !claimedByYou)

  return (
    <DirectoryClaimClient
      listing={{
        type: target.type,
        token,
        firm_name: String(listing.firm_name ?? ''),
        contact_name: (listing.contact_name as string | null) ?? null,
        email: String(listing.email ?? ''),
        phone: (listing.phone as string | null) ?? null,
        website: (listing.website as string | null) ?? null,
        city: (listing.city as string | null) ?? null,
        state: (listing.state as string | null) ?? null,
        bio: (listing.bio as string | null) ?? null,
        alreadyClaimed,
        claimedByYou,
      }}
      isLoggedIn={!!user}
      userEmail={user?.email ?? null}
    />
  )
}
