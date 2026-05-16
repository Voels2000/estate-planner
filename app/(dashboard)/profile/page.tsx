// ─────────────────────────────────────────
// Menu: Profile
// Route: /profile
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildProfileFormInitial } from '@/lib/profile/profileFormInitial'
import { ProfileClient } from './_profile-client'

type PageProps = {
  searchParams: Promise<{ from?: string }>
}

export default async function ProfilePage({ searchParams }: PageProps) {
  const { from } = await searchParams
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

  return <ProfileClient initial={initial} fromParam={from ?? null} />
}
