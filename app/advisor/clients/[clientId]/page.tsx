// app/advisor/clients/[clientId]/page.tsx
// Server component — auth, access check, data fetch, tab dispatch

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import ClientViewShell from './_client-view-shell'

interface PageProps {
  params: { clientId: string }
  searchParams: { tab?: string }
}

export default async function AdvisorClientPage({ params, searchParams }: PageProps) {
  const { clientId } = params
  const tab = searchParams.tab ?? 'overview'

  // ── Auth ────────────────────────────────────────────────────────────────────
  const ctx = await getAccessContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.isAdvisor) redirect('/dashboard')

  const supabase = createClient()

  // ── Verify advisor→client link ──────────────────────────────────────────────
  const { data: link, error: linkError } = await supabase
    .from('advisor_clients')
    .select('id, status, accepted_at, client_id')
    .eq('advisor_id', ctx.user.id)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()

  if (linkError || !link) redirect('/advisor')

  // ── Household ───────────────────────────────────────────────────────────────
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
      estate_complexity_score, estate_complexity_flag,
      inflation_rate, growth_rate_accumulation, growth_rate_retirement,
      person1_ss_benefit_62, person1_ss_benefit_67,
      person2_ss_benefit_62, person2_ss_benefit_67,
      last_recommendation_at, created_at, updated_at
    `)
    .eq('owner_id', clientId)
    .single()

  if (!household) redirect('/advisor')

  // ── Assets ──────────────────────────────────────────────────────────────────
  const { data: assets } = await supabase
    .from('assets')
    .select('id, name, asset_type, value, owner, institution, account_type, is_taxable, created_at')
    .eq('owner_id', clientId)

  // ── Real Estate ─────────────────────────────────────────────────────────────
  const { data: realEstate } = await supabase
    .from('real_estate')
    .select('id, name, property_type, current_value, purchase_price, mortgage_balance, monthly_payment, interest_rate, is_primary_residence, situs_state, owner')
    .eq('owner_id', clientId)

  // ── Beneficiaries ───────────────────────────────────────────────────────────
  const { data: beneficiaries } = await supabase
    .from('beneficiaries')
    .select('id, name, relationship, allocation_pct, account_type, contingent, created_at')
    .eq('owner_id', clientId)

  // ── Estate Documents ────────────────────────────────────────────────────────
  const { data: estateDocuments } = await supabase
    .from('estate_documents')
    .select('id, document_type, exists, confirmed_at, created_at')
    .eq('owner_id', clientId)

  // ── Legal Documents (vault) ─────────────────────────────────────────────────
  const { data: legalDocuments } = await supabase
    .from('legal_documents')
    .select('id, document_type, file_name, uploader_role, version, is_current, created_at')
    .eq('household_id', household.id)
    .eq('is_current', true)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  // ── Advisor Notes (advisor-only, consumer never sees these) ─────────────────
  const { data: notes } = await supabase
    .from('advisor_notes')
    .select('id, content, created_at, updated_at')
    .eq('advisor_id', ctx.user.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  // ── Log this access ─────────────────────────────────────────────────────────
  try {
    await supabase.from('advisor_access_log').insert({
      advisor_id: ctx.user.id,
      client_id: clientId,
      accessed_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[advisor-client-view] access log failed:', e)
  }

  return (
    <ClientViewShell
      tab={tab}
      advisorId={ctx.user.id}
      clientId={clientId}
      household={household}
      assets={assets ?? []}
      realEstate={realEstate ?? []}
      beneficiaries={beneficiaries ?? []}
      estateDocuments={estateDocuments ?? []}
      legalDocuments={legalDocuments ?? []}
      notes={notes ?? []}
    />
  )
}
