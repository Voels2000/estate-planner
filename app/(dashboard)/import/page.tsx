import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportClient } from './_import-client'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: jobs } = await supabase
    .from('ingestion_jobs')
    .select('id, file_name, file_type, status, row_count, committed_at, created_at, error_message')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return <ImportClient jobs={jobs ?? []} />
}
