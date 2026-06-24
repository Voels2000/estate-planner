// ─────────────────────────────────────────
// Menu: Financial Planning > Income
// Route: /income
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { getUserAccess } from '@/lib/get-user-access'
import { isWizardComplete } from '@/lib/estate/profileGate'
import { IncomeClient } from './_income-client'

export default async function IncomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: income }, { data: household }, { data: incomeTypes }, { data: profile }] =
    await Promise.all([
    supabase.from('income').select('*').eq('owner_id', user.id).neq('source', 'social_security').order('created_at', { ascending: false }),
    supabase.from('households').select('person1_name, person2_name, has_spouse').eq('owner_id', user.id).single(),
    supabase.from('income_types').select('value, label').eq('is_active', true).order('sort_order'),
    supabase.from('profiles').select('onboarding_wizard_completed_at').eq('id', user.id).single(),
  ])

  const access = await getUserAccess()
  const wizardComplete = isWizardComplete(profile)
  const showImportCta = !wizardComplete && access.tier < 2

  return (
    <IncomeClient
      showImportCta={showImportCta}
      income={income ?? []}
      person1Name={displayPersonFirstName(household?.person1_name, 'Person 1')}
      person2Name={displayPersonFirstName(household?.person2_name, 'Person 2')}
      hasSpouse={household?.has_spouse ?? false}
      incomeTypes={incomeTypes ?? []}
    />
  )
}
