import { redirect } from 'next/navigation'
import { detectConflicts } from '@/lib/conflict-detector'
import { createClient } from '@/lib/supabase/server'
import ClientViewShell from './_client-view-shell'

interface PageProps {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AdvisorClientPage({ params, searchParams }: PageProps) {
  const { clientId } = await params
  const tab = (await searchParams).tab ?? 'overview'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'advisor') redirect('/dashboard')

  const { data: link, error: linkError } = await supabase
    .from('advisor_clients')
    .select('id, status, accepted_at, client_id, client_status')
    .eq('advisor_id', user.id)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()

  if (linkError || !link) redirect('/advisor')

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
      person2_ss_benefit_62, person2_ss_benefit_67,
      last_recommendation_at, created_at, updated_at
    `)
    .eq('owner_id', clientId)
    .single()

  if (!household) redirect('/advisor')

  const { data: assets } = await supabase
    .from('assets')
    .select('id, name, asset_type, value, owner, institution, account_type, is_taxable, created_at')
    .eq('owner_id', clientId)

  const { data: realEstate } = await supabase
    .from('real_estate')
    .select('id, name, property_type, current_value, purchase_price, mortgage_balance, monthly_payment, interest_rate, is_primary_residence, situs_state, owner')
    .eq('owner_id', clientId)

  const { data: beneficiaries } = await supabase
    .from('beneficiaries')
    .select('id, name, relationship, allocation_pct, account_type, contingent, created_at')
    .eq('owner_id', clientId)

  const { data: estateDocuments } = await supabase
    .from('estate_documents')
    .select('id, document_type, exists, confirmed_at, created_at')
    .eq('owner_id', clientId)

  const { data: legalDocuments } = await supabase
    .from('legal_documents')
    .select('id, document_type, file_name, uploader_role, version, is_current, created_at')
    .eq('household_id', household.id)
    .eq('is_current', true)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  const { data: notes } = await supabase
    .from('advisor_notes')
    .select('id, content, created_at, updated_at')
    .eq('advisor_id', user.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  // ── Estate Tax RPC ────────────────────────────────────────────────────────
  const { data: estateTaxRaw } = await supabase
    .rpc('calculate_state_estate_tax', {
      p_household_id: household.id,
    })

  const estateTax = estateTaxRaw ?? null

  // ── Domicile Analysis ─────────────────────────────────────────────────────
  const { data: domicileAnalysis } = await supabase
    .from('domicile_analysis')
    .select(`
      id, claimed_domicile_state, states,
      drivers_license_state, voter_registration_state,
      vehicle_registration_state, primary_home_titled_state,
      spouse_children_state, estate_docs_declare_state,
      files_taxes_in_state, business_interests_state,
      risk_score, risk_level, dominant_state,
      conflict_states, recommendations,
      created_at, updated_at
    `)
    .eq('household_id', household.id)
    .single()

  // Run conflict detector for advisor view (Sprint 58)
  let conflictReport = null
  try {
    conflictReport = await detectConflicts(household.id, clientId)
  } catch (e) {
    console.error('[advisor-client-view] conflict detection failed:', e)
  }

  try {
    await supabase.from('advisor_access_log').insert({
      advisor_id: user.id,
      client_id: clientId,
      accessed_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[advisor-client-view] access log failed:', e)
  }

  return (
    <ClientViewShell
      tab={tab}
      advisorId={user.id}
      clientId={clientId}
      clientStatus={link.client_status ?? 'active'}
      household={household}
      assets={assets ?? []}
      realEstate={realEstate ?? []}
      beneficiaries={beneficiaries ?? []}
      estateDocuments={estateDocuments ?? []}
      legalDocuments={legalDocuments ?? []}
      notes={notes ?? []}
      estateTax={estateTax}
      domicileAnalysis={domicileAnalysis ?? null}
      conflictReport={conflictReport}
    />
  )
}
