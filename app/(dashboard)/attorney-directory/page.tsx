import { createClient } from '@/lib/supabase/server'
import { AttorneyDirectoryClient } from './_attorney-directory-client'

export default async function AttorneyDirectoryPage() {
  const supabase = await createClient()

  const { data: attorneys } = await supabase
    .from('attorney_listings')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const allSpecializations = Array.from(
    new Set((attorneys ?? []).flatMap(a => a.specializations ?? []))
  ).sort()

  const allStates = Array.from(
    new Set((attorneys ?? []).map(a => a.state).filter(Boolean))
  ).sort()

  return (
    <AttorneyDirectoryClient
      attorneys={attorneys ?? []}
      allSpecializations={allSpecializations}
      allStates={allStates}
    />
  )
}
