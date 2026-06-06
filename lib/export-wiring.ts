/**
 * Server-side fetchers for advisor ExportPanel and Meeting Prep wiring.
 */

import { mapHealthComponentsForPdf } from '@/lib/advisor/advisorBriefHelpers'
import { createClient } from '@/lib/supabase/server'

export interface ActionItem {
  id: string
  title?: string
  message: string
  body?: string
  severity: string
  created_at: string
  dollarImpact?: string
  nextStep?: string
  owner?: 'client' | 'advisor' | 'attorney'
  theme?: 'titling' | 'documents' | 'tax_planning' | 'beneficiary' | 'general'
}

export interface ScenarioVersion {
  id: string
  created_at: string
  label: string
  gross_estate: number
}

export interface MonteCarloSummary {
  p10: number
  p50: number
  p90: number
  paths: number
}

export type HealthScoreComponent = { label: string; score: number; maxScore: number }

export type HealthScoreResult = {
  score: number | null
  computedAt: string | null
  components: HealthScoreComponent[]
}

export type AdvisorProfileRow = {
  full_name: string | null
  email: string | null
  firm_name: string | null
  phone: string | null
  firm_logo_url: string | null
}

export async function fetchHealthScore(householdId: string): Promise<HealthScoreResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('estate_health_scores')
    .select('score, computed_at, component_scores')
    .eq('household_id', householdId)
    .maybeSingle()

  if (error || data == null) {
    return { score: null, computedAt: data?.computed_at ?? null, components: [] }
  }

  const componentScores = data.component_scores as Record<string, { label?: string; score?: number; maxScore?: number }> | null
  const components = mapHealthComponentsForPdf(componentScores)

  if (data.score == null) {
    return { score: null, computedAt: data.computed_at ?? null, components }
  }
  return {
    score: data.score,
    computedAt: data.computed_at ?? null,
    components,
  }
}

export async function fetchLiquidAssets(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assets')
    .select('value')
    .eq('owner_id', userId)
    .eq('liquidity', 'liquid')

  if (error || !data) return 0
  return data.reduce((sum, a) => sum + (Number(a.value) || 0), 0)
}

export async function fetchActiveStrategies(householdId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('strategy_configs')
    .select('strategy_type, label')
    .eq('household_id', householdId)
    .eq('is_active', true)

  if (error || !data) return []

  const STRATEGY_LABELS: Record<string, string> = {
    gifting: 'Annual Gifting Program',
    revocable_trust: 'Revocable Living Trust',
    credit_shelter_trust: 'Credit Shelter Trust (CST)',
    slat: 'Spousal Lifetime Access Trust (SLAT)',
    ilit: 'Irrevocable Life Insurance Trust (ILIT)',
    grat: 'Grantor Retained Annuity Trust (GRAT)',
    crt: 'Charitable Remainder Trust (CRT)',
    clat: 'Charitable Lead Annuity Trust (CLAT)',
    daf: 'Donor-Advised Fund (DAF)',
    roth_conversion: 'Roth Conversion Strategy',
  }

  return data.map((s) => s.label || STRATEGY_LABELS[s.strategy_type] || s.strategy_type)
}

export async function fetchActionItems(householdId: string): Promise<ActionItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('household_alerts')
    .select('id, title, description, severity, created_at')
    .eq('household_id', householdId)
    .is('resolved_at', null)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return []
  return data.map((a) => ({
    id: a.id,
    title: (a.title || '').trim() || 'Alert',
    message: (a.description || a.title || '').trim() || 'Alert',
    severity: a.severity ?? 'info',
    created_at: a.created_at,
  }))
}

export async function fetchAdvisorDisplayName(advisorUserId: string): Promise<string> {
  const profile = await fetchAdvisorProfile(advisorUserId)
  const name = (profile.full_name || '').trim()
  if (name) return name
  const email = profile.email
  return email ? email.split('@')[0] ?? '' : ''
}

export async function fetchAdvisorProfile(advisorUserId: string): Promise<AdvisorProfileRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, email, firm_name, phone, firm_logo_url')
    .eq('id', advisorUserId)
    .maybeSingle()

  if (error || !data) {
    return { full_name: null, email: null, firm_name: null, phone: null, firm_logo_url: null }
  }
  return {
    full_name: data.full_name ?? null,
    email: data.email ?? null,
    firm_name: (data as { firm_name?: string | null }).firm_name ?? null,
    phone: (data as { phone?: string | null }).phone ?? null,
    firm_logo_url: (data as { firm_logo_url?: string | null }).firm_logo_url ?? null,
  }
}

export async function fetchScenarioHistoryForExport(householdId: string): Promise<ScenarioVersion[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projection_scenarios')
    .select('id, created_at, calculated_at, label, outputs_s1_first')
    .eq('household_id', householdId)
    .eq('status', 'saved')
    .order('version', { ascending: false })
    .limit(10)

  if (error || !data) return []

  return data.map((s) => {
    let gross_estate = 0
    const outputs = s.outputs_s1_first
    if (Array.isArray(outputs) && outputs.length > 0) {
      const row = outputs[0] as Record<string, unknown>
      gross_estate = Number(row.estate_incl_home ?? row.gross_estate ?? 0)
    }
    const created = s.calculated_at ?? s.created_at ?? ''
    return {
      id: s.id,
      created_at: created,
      label: s.label || 'Base Case',
      gross_estate,
    }
  })
}

export async function fetchMonteCarloSummary(scenarioId: string): Promise<MonteCarloSummary | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('monte_carlo_results')
    .select('p10_estate, p50_estate, p90_estate, simulation_count')
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return {
    p10: Number(data.p10_estate ?? 0),
    p50: Number(data.p50_estate ?? 0),
    p90: Number(data.p90_estate ?? 0),
    paths: Number(data.simulation_count ?? 500),
  }
}
