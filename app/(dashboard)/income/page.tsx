import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IncomeClient } from './_income-client'

export default async function IncomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: income }, { data: household }] = await Promise.all([
    supabase.from('income').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('households').select('person1_name, person2_name, has_spouse').eq('owner_id', user.id).single(),
  ])

  return (
    <IncomeClient
      income={income ?? []}
      ownerId={user.id}
      person1Name={household?.person1_name ?? 'Person 1'}
      person2Name={household?.person2_name ?? 'Person 2'}
      hasSpouse={household?.has_spouse ?? false}
    />
  )
}
