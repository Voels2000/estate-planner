import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { ImportClient } from './_import-client'

export default async function ImportPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Document Import</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Document Import"
          valueProposition="Import and organize existing estate documents into your secure vault."
        />
      </div>
    )
  }

  const { data: jobs } = await supabase
    .from('ingestion_jobs')
    .select('id, file_name, file_type, status, row_count, committed_at, created_at, error_message')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return <ImportClient jobs={jobs ?? []} />
}
