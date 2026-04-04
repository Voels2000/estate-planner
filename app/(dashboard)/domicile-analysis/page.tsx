import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DomicileAnalysisClient from './_domicile-analysis-client'

export const metadata = { title: 'Multi-State Domicile Analysis' }

export default async function DomicileAnalysisPage() {
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

  const isAdvisor = profile?.role === 'advisor'

  // Former tier billing redirect removed — layout enforces subscription.

  const currentYear = new Date().getFullYear()

  const [
    { data: analysis },
    { data: stateEstateTaxRows },
    { data: stateInheritanceTaxRows },
    { data: stateIncomeTaxRows },
  ] = await Promise.all([
    supabase
      .from('domicile_analysis')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Fetch most recent two years so client can fall back if current year missing
    supabase
      .from('state_estate_tax_rules')
      .select('state, exemption_amount, tax_year, min_amount')
      .gte('tax_year', currentYear - 1)
      .order('tax_year', { ascending: false })
      .order('state', { ascending: true }),
    supabase
      .from('state_inheritance_tax_rules')
      .select('state, tax_year')
      .gte('tax_year', currentYear - 1)
      .order('tax_year', { ascending: false }),
    supabase
      .from('state_income_tax_rates')
      .select('state_code, rate_pct, tax_year')
      .gte('tax_year', currentYear - 1)
      .order('tax_year', { ascending: false }),
  ])

  const { data: checklistItems } = analysis
    ? await supabase
        .from('domicile_checklist_items')
        .select('*')
        .eq('analysis_id', analysis.id)
        .order('priority', { ascending: false })
        .order('category', { ascending: true })
    : { data: [] }

  let clients: { id: string; full_name: string; email: string }[] = []
  if (isAdvisor) {
    const { data: advisorClients } = await supabase
      .from('advisor_clients')
      .select(
        'client_id, profiles!advisor_clients_client_id_fkey(id, full_name, email)'
      )
      .eq('advisor_id', user.id)
      .eq('status', 'active')

    clients = (advisorClients ?? []).map((ac) => {
      const raw = ac.profiles as
        | { id: string; full_name: string | null; email: string | null }
        | { id: string; full_name: string | null; email: string | null }[]
        | null
      const p = Array.isArray(raw) ? raw[0] : raw
      return {
        id: p?.id ?? ac.client_id,
        full_name: p?.full_name ?? '',
        email: p?.email ?? '',
      }
    })
  }

  return (
    <DomicileAnalysisClient
      initialAnalysis={analysis}
      initialChecklist={checklistItems ?? []}
      role={profile?.role ?? 'consumer'}
      clients={clients}
      userId={user.id}
      stateEstateTaxRules={stateEstateTaxRows ?? []}
      stateInheritanceTaxRules={stateInheritanceTaxRows ?? []}
      stateIncomeTaxRates={stateIncomeTaxRows ?? []}
    />
  )
}
