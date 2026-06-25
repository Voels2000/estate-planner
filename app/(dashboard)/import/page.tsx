import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import { isAdvisorIdentity } from '@/lib/access/isAdvisorIdentity'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { ImportClient } from './_import-client'

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const { onboarding } = await searchParams
  const onboardingMode = onboarding === 'true'
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const hasImportFeature = hasFeatureAccess('import', access.tier, access.isAdvisor, access.isTrial)
  // Job history table is Tier 2+ only; advisors (by role) use a different import workflow.
  const showImportHistory = access.tier >= 2 && !isAdvisorIdentity(profile?.role)

  if (!hasImportFeature) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Import Data</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('import')}
          moduleName="Import Data"
          valueProposition="Upload CSV or Excel files to import assets, liabilities, income, and expenses in bulk."
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

  return (
    <ImportClient
      jobs={jobs ?? []}
      showImportHistory={showImportHistory}
      showOnboardingBanner={false}
      consumerTier={access.tier}
      onboardingMode={onboardingMode}
    />
  )
}
