import { getUserAccess } from '@/lib/get-user-access'
import { createClient } from '@/lib/supabase/server'
import { PrintClient } from './_print-client'

export default async function PrintPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!household) return null

  return (
    <PrintClient
      householdId={household.id}
      isAdvisor={access.isAdvisor}
      tier={access.tier}
    />
  )
}
