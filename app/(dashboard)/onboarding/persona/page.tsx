import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isMinimumViableProfile } from '@/lib/estate/profileGate'
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
    supabase
      .from('households')
      .select('person1_name, state_primary, filing_status, person1_birth_year')
      .eq('owner_id', user.id)
      .maybeSingle(),
  ])

  if (profile?.onboarding_persona) {
    redirect('/onboarding/wizard')
  }

  const gate = isMinimumViableProfile(household ?? {})
  if (!gate.complete) {
    redirect('/profile?required=true')
  }

  if (profile?.role && profile.role !== 'consumer') {
    redirect('/dashboard')
  }

  return <PersonaOnboardingClient />
}
