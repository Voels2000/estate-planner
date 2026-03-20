import { getUserAccess } from '@/lib/get-user-access'
import { GatedPage } from '@/components/gated-page'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportClient } from './_import-client'

export default async function ImportPage() {
  const access = await getUserAccess()
  if (access.tier < 2) {
    return (
      <GatedPage requiredTier={2} currentTier={access.tier} featureName="Import Data">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h1 className="text-2xl font-bold text-neutral-900">Import Data</h1>
        </div>
      </GatedPage>
    )
  }
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
