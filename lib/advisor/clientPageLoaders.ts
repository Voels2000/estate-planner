/**
 * Advisor page access guards and scoped household loaders.
 *
 * Centralizes advisor auth/role checks and advisor-client relationship enforcement
 * for `/advisor/clients/[clientId]` server pages.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

type AdvisorProfileRole = {
  role: string | null
}

type AdvisorClientLink = {
  id: string
  status: string
  accepted_at: string | null
  client_id: string
  client_status: string | null
}

export async function loadAdvisorContextOrRedirect(
  supabase: ServerSupabase,
): Promise<{ userId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<AdvisorProfileRole>()

  if (profile?.role !== 'advisor') redirect('/dashboard')

  return { userId: user.id }
}

export async function loadAdvisorClientLinkOrRedirect(
  supabase: ServerSupabase,
  params: { advisorId: string; clientId: string },
): Promise<AdvisorClientLink> {
  const { data: link, error: linkError } = await supabase
    .from('advisor_clients')
    .select('id, status, accepted_at, client_id, client_status')
    .eq('advisor_id', params.advisorId)
    .eq('client_id', params.clientId)
    .eq('status', 'active')
    .single<AdvisorClientLink>()

  if (linkError || !link) redirect('/advisor')
  return link
}

export async function loadAdvisorClientHouseholdOrRedirect(
  supabase: ServerSupabase,
  clientId: string,
) {
  const { data: household } = await supabase
    .from('households')
    .select(`
      id, owner_id, name,
      person1_first_name, person1_last_name, person1_birth_year,
      person1_retirement_age, person1_ss_claiming_age, person1_longevity_age,
      has_spouse,
      person2_first_name, person2_last_name, person2_birth_year,
      person2_retirement_age, person2_ss_claiming_age, person2_longevity_age,
      filing_status, state_primary,
      risk_tolerance, target_stocks_pct, target_bonds_pct, target_cash_pct,
      base_case_scenario_id,
      estate_complexity_score, estate_complexity_flag,
      inflation_rate, growth_rate_accumulation, growth_rate_retirement,
      person1_ss_benefit_62, person1_ss_benefit_67,
      person1_ss_pia, person2_ss_pia,
      person2_ss_benefit_62, person2_ss_benefit_67,
      last_recommendation_at, created_at, updated_at, admin_expense_pct
    `)
    .eq('owner_id', clientId)
    .single()

  if (!household) redirect('/advisor')
  return household
}
