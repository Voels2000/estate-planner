import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import { hasFeatureAccess } from '@/lib/tiers'
import { isWizardComplete } from '@/lib/estate/profileGate'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { ImportClient } from './_import-client'

export default async function ImportPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_wizard_completed_at')
    .eq('id', user.id)
    .single()

  const wizardComplete = isWizardComplete(profile)
  const hasImportFeature = hasFeatureAccess('import', access.tier, access.isAdvisor, access.isTrial)
  const allowOnboardingImport = !wizardComplete && access.tier < 2 && !access.isAdvisor

  if (!hasImportFeature && !allowOnboardingImport) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Import Data</h1>
        <UpgradeBanner
          requiredTier={2}
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
      showImportHistory={hasImportFeature}
      showOnboardingBanner={allowOnboardingImport}
      consumerTier={access.tier}
    />
  )
}
