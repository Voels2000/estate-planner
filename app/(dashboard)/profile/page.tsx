// ─────────────────────────────────────────
// Menu: Profile
// Route: /profile
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProfileGateMissingField } from '@/lib/estate/profileGate'
import { buildProfileFormInitial } from '@/lib/profile/profileFormInitial'
import { ProfileClient } from './_profile-client'

type PageProps = {
  searchParams: Promise<{
    from?: string
    required?: string
    missing?: string
  }>
}

export default async function ProfilePage({ searchParams }: PageProps) {
  const { from, required, missing } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: household }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
    supabase.from('households').select('*').eq('owner_id', user.id).single(),
  ])

  const initial = buildProfileFormInitial(profile, household, user.email ?? '')

  const missingFields =
    missing?.split(',').filter(Boolean) ?? []

  return (
    <ProfileClient
      initial={initial}
      fromParam={from ?? null}
      requiredParam={required === 'true'}
      missingFields={missingFields as ProfileGateMissingField[]}
      householdSnapshot={{
        state_primary: household?.state_primary ?? null,
        filing_status: household?.filing_status ?? null,
        person1_birth_year: household?.person1_birth_year ?? null,
      }}
    />
  )
}
