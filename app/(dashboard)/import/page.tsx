import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import { hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { ImportClient } from './_import-client'

export default async function ImportPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (!hasFeatureAccess('import', access.tier, access.isAdvisor, access.isTrial)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Import Data</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Import Data"
          valueProposition="Upload CSV or Excel files to import assets, liabilities, income, and expenses in bulk."
        />
      </div>
    )
  }

  const { data: rawJobs } = await supabase
    .from('ingestion_jobs')
    .select('id, original_filename, source_format, status, row_count, committed_at, created_at, error_message')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const jobs = (rawJobs ?? []).map((job) => ({
    id: job.id,
    file_name: job.original_filename ?? 'Unknown file',
    file_type: job.source_format ?? '',
    status: job.status,
    row_count: job.row_count,
    committed_at: job.committed_at,
    created_at: job.created_at,
    error_message: job.error_message,
  }))

  return <ImportClient jobs={jobs} />
}
