import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IncomeClient } from './_income-client'

export default async function IncomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: income } = await supabase
    .from('income')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <IncomeClient
      income={income ?? []}
      ownerId={user.id}
    />
  )
}
