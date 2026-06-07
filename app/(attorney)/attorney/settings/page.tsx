import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttorneySettingsClient } from './_attorney-settings-client'

export default async function AttorneySettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('attorney_listings')
    .select(
      'id, firm_name, contact_name, email, phone, website, city, state, bio, fee_structure',
    )
    .eq('profile_id', user.id)
    .maybeSingle()

  return <AttorneySettingsClient initialListing={listing} />
}
