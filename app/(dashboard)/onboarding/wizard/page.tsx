import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import {
  isMinimumViableProfile,
  isWizardComplete,
  isWizardReadyProfile,
} from '@/lib/estate/profileGate'
import { OnboardingWizardClient } from './_wizard-client'
import { getPersonaConfig } from '@/lib/onboarding/personaConfig'

export default async function OnboardingWizardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: household }, { data: assetTypes }, { data: incomeTypes }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, role, onboarding_wizard_completed_at, referral_code, onboarding_persona')
        .eq('id', user.id)
        .single(),
      supabase.from('households').select('*').eq('owner_id', user.id).maybeSingle(),
      supabase
        .from('asset_types')
        .select('value, label')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('income_types')
        .select('value, label')
        .eq('is_active', true)
        .order('sort_order'),
    ])

  if (isWizardComplete(profile)) {
    redirect('/dashboard')
  }

  if (!profile?.onboarding_persona) {
    redirect('/onboarding/persona')
  }

  if (!isWizardReadyProfile(household)) {
    const gate = isMinimumViableProfile(household ?? {})
    redirect(gate.complete ? '/dashboard' : '/profile?required=true')
  }

  if (profile?.role && profile.role !== 'consumer') {
    redirect('/dashboard')
  }

  const person1Label =
    household?.person1_first_name?.trim() ||
    household?.person1_name?.trim()?.split(' ')[0] ||
    'You'
  const person2Label =
    household?.person2_first_name?.trim() ||
    household?.person2_name?.trim()?.split(' ')[0] ||
    'Spouse'

  const appUrl = getAppUrl()
  const findAdvisorUrl = profile?.referral_code
    ? `${appUrl}/find-advisor?ref=${encodeURIComponent(profile.referral_code)}`
    : `${appUrl}/find-advisor`
  const inviteEmailSubject = encodeURIComponent("I've started my estate plan on My Wealth Maps")
  const inviteEmailBody = encodeURIComponent(
    `I'm using My Wealth Maps to organize my financial and estate planning.\n\nYou can connect with me at: ${findAdvisorUrl}`,
  )

  const personaConfig = getPersonaConfig(profile?.onboarding_persona)

  return (
    <OnboardingWizardClient
      person1Label={person1Label}
      person2Label={person2Label}
      hasSpouse={!!household?.has_spouse}
      assetTypes={assetTypes ?? []}
      incomeTypes={incomeTypes ?? []}
      inviteMailto={`mailto:?subject=${inviteEmailSubject}&body=${inviteEmailBody}`}
      personaConfig={personaConfig}
    />
  )
}
