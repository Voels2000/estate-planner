import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isWizardReadyProfile } from '@/lib/estate/profileGate'
import { PersonaOnboardingClient } from './_persona-client'

export default async function PersonaOnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: household }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, role, onboarding_persona, onboarding_wizard_completed_at')
      .eq('id', user.id)
      .single(),
    supabase.from('households').select('*').eq('owner_id', user.id).maybeSingle(),
  ])

  if (profile?.onboarding_persona) {
    redirect('/onboarding/wizard')
  }

  if (!isWizardReadyProfile(household)) {
    redirect('/profile?required=true&from=%2Fonboarding%2Fpersona')
  }

  if (profile?.role && profile.role !== 'consumer') {
    redirect('/dashboard')
  }

  return <PersonaOnboardingClient />
}
