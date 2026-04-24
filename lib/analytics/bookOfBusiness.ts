// Sprint 62 — Book-of-Business Analytics data functions
// Aggregates health scores, estate tax exposure, alerts, and large-estate exposure.
// across all clients for an advisor. Reads from stored projection data only.

import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientSummary {
  client_id: string
  household_id: string
  full_name: string
  email: string
  health_score: number | null
  gross_estate: number | null
  estate_tax_federal_current: number | null
  has_projection: boolean
  active_alert_count: number
  high_alert_count: number
  has_active_strategies: boolean
  net_to_heirs: number | null
}

export interface HealthScoreDistribution {
  band: string
  label: string
  count: number
  color: string
}

export interface EstateTaxBand {
  band: string
  label: string
  count: number
  min: number
  max: number | null
}

export interface LargeEstateExposure {
  client_id: string
  household_id: string
  full_name: string
  gross_estate: number
  federal_tax: number
  state_tax: number
  total_tax: number
}

export interface BookOfBusinessData {
  clients: ClientSummary[]
  healthDistribution: HealthScoreDistribution[]
  taxBands: EstateTaxBand[]
  largeEstateExposures: LargeEstateExposure[]
  staleDocumentClients: ClientSummary[]
  unplannedExposureClients: ClientSummary[]
  openConflictClients: ClientSummary[]
  totalClients: number
  averageHealthScore: number | null
  totalProjectedTax: number
}

// ─── Main data fetcher ────────────────────────────────────────────────────────

export async function fetchBookOfBusiness(advisorId: string): Promise<BookOfBusinessData> {
  const supabase = createClient()

  // Fetch advisor's clients
  const { data: clientRows } = await supabase
    .from('advisor_clients')
    .select('client_id, status')
    .eq('advisor_id', advisorId)
    .eq('status', 'active')

  if (!clientRows || clientRows.length === 0) {
    return emptyData()
  }

  const clientIds = clientRows.map(r => r.client_id)

  // Fetch all data in parallel
  const [
    profilesRes,
    householdsRes,
    healthScoresRes,
    projectionsRes,
    alertsRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', clientIds),
    supabase
      .from('households')
      .select('id, owner_id, name, base_case_scenario_id')
      .in('owner_id', clientIds),
    supabase
      .from('estate_health_scores')
      .select('household_id, score')
      .in('household_id',
        // Will be filtered after households are loaded
        clientIds // placeholder, filtered below
      ),
    supabase
      .from('projection_scenarios')
      .select('id, household_id, outputs_s1_first, status')
      .in('household_id', clientIds) // placeholder, filtered below
      .eq('status', 'saved'),
    supabase
      .from('household_alerts')
      .select('household_id, severity')
      .is('resolved_at', null)
      .is('dismissed_at', null),
  ])

  const profiles = profilesRes.data ?? []
  const households = householdsRes.data ?? []
  const healthScores = healthScoresRes.data ?? []
  const projections = projectionsRes.data ?? []
  const alerts = alertsRes.data ?? []

  // Build lookup maps
  const profileMap = new Map(profiles.map(p => [p.id, p]))
  const householdByOwner = new Map(households.map(h => [h.owner_id, h]))
  const healthScoreMap = new Map(healthScores.map(s => [s.household_id, s.score]))

  // Group alerts by household
  const alertsByHousehold = new Map<string, { total: number; high: number }>()
  for (const alert of alerts) {
    const existing = alertsByHousehold.get(alert.household_id) ?? { total: 0, high: 0 }
    existing.total++
    if (alert.severity === 'high' || alert.severity === 'critical') existing.high++
    alertsByHousehold.set(alert.household_id, existing)
  }

  // Get base case projections per household
  const projectionByHousehold = new Map<string, typeof projections[0]>()
  for (const proj of projections) {
    if (!projectionByHousehold.has(proj.household_id)) {
      projectionByHousehold.set(proj.household_id, proj)
    }
  }

  // Build client summaries
  const clients: ClientSummary[] = clientIds.map(clientId => {
    const profile = profileMap.get(clientId)
    const household = householdByOwner.get(clientId)
    const householdId = household?.id ?? ''
    const healthScore = household ? healthScoreMap.get(householdId) ?? null : null
    const projection = household ? projectionByHousehold.get(householdId) : null
    const alertCounts = alertsByHousehold.get(householdId) ?? { total: 0, high: 0 }

    // Extract tax data from projection outputs
    let grossEstate: number | null = null
    let taxCurrent: number | null = null
    let netToHeirs: number | null = null

    if (projection?.outputs_s1_first) {
      const outputs = projection.outputs_s1_first as Record<string, number>[]
      const lastRow = outputs[outputs.length - 1]
      if (lastRow) {
        grossEstate = lastRow.estate_incl_home ?? null
        taxCurrent = lastRow.estate_tax_federal ?? null
        netToHeirs = lastRow.net_to_heirs ?? null
      }
    }

    return {
      client_id: clientId,
      household_id: householdId,
      full_name: profile?.full_name ?? profile?.email ?? 'Unknown',
      email: profile?.email ?? '',
      health_score: healthScore,
      gross_estate: grossEstate,
      estate_tax_federal_current: taxCurrent,
      has_projection: !!projection,
      active_alert_count: alertCounts.total,
      high_alert_count: alertCounts.high,
      has_active_strategies: false, // extended in Sprint 67
      net_to_heirs: netToHeirs,
    }
  })

  // Build analytics panels
  const healthDistribution = buildHealthDistribution(clients)
  const taxBands = buildTaxBands(clients)
  const largeEstateExposures = buildLargeEstateExposures(clients)
  const staleDocumentClients = clients.filter(c => c.active_alert_count > 0)
  const unplannedExposureClients = clients.filter(
    c => (c.estate_tax_federal_current ?? 0) > 2_000_000 && !c.has_active_strategies
  )
  const openConflictClients = clients.filter(c => c.high_alert_count > 0)

  const scoredClients = clients.filter(c => c.health_score !== null)
  const averageHealthScore = scoredClients.length > 0
    ? Math.round(scoredClients.reduce((s, c) => s + (c.health_score ?? 0), 0) / scoredClients.length)
    : null

  const totalProjectedTax = clients.reduce((s, c) => s + (c.estate_tax_federal_current ?? 0), 0)

  return {
    clients,
    healthDistribution,
    taxBands,
    largeEstateExposures,
    staleDocumentClients,
    unplannedExposureClients,
    openConflictClients,
    totalClients: clients.length,
    averageHealthScore,
    totalProjectedTax,
  }
}

// ─── Panel builders ───────────────────────────────────────────────────────────

function buildHealthDistribution(clients: ClientSummary[]): HealthScoreDistribution[] {
  const bands = [
    { band: 'red', label: '0–39', color: '#EF4444', min: 0, max: 39 },
    { band: 'amber', label: '40–69', color: '#F59E0B', min: 40, max: 69 },
    { band: 'green', label: '70–100', color: '#10B981', min: 70, max: 100 },
    { band: 'none', label: 'No score', color: '#9CA3AF', min: -1, max: -1 },
  ]

  return bands.map(b => ({
    band: b.band,
    label: b.label,
    color: b.color,
    count: b.band === 'none'
      ? clients.filter(c => c.health_score === null).length
      : clients.filter(c => c.health_score !== null && c.health_score >= b.min && c.health_score <= b.max).length,
  }))
}

function buildTaxBands(clients: ClientSummary[]): EstateTaxBand[] {
  return [
    { band: 'none', label: '$0', min: 0, max: 1, count: 0 },
    { band: 'low', label: '$1 – $2M', min: 1, max: 2_000_000, count: 0 },
    { band: 'mid', label: '$2M – $5M', min: 2_000_000, max: 5_000_000, count: 0 },
    { band: 'high', label: '$5M+', min: 5_000_000, max: null, count: 0 },
  ].map(band => ({
    ...band,
    count: clients.filter(c => {
      const tax = c.estate_tax_federal_current ?? 0
      if (band.max === null) return tax >= band.min
      return tax >= band.min && tax < band.max
    }).length,
  }))
}

function buildLargeEstateExposures(clients: ClientSummary[]): LargeEstateExposure[] {
  return clients
    .filter(c => (c.estate_tax_federal_current ?? 0) >= 500_000 && c.has_projection)
    .map(c => ({
      client_id: c.client_id,
      household_id: c.household_id,
      full_name: c.full_name,
      gross_estate: c.gross_estate ?? 0,
      federal_tax: c.estate_tax_federal_current ?? 0,
      state_tax: 0, // state tax not currently threaded into ClientSummary; leave 0 for now
      total_tax: c.estate_tax_federal_current ?? 0,
    }))
    .sort((a, b) => b.federal_tax - a.federal_tax)
}

function emptyData(): BookOfBusinessData {
  return {
    clients: [],
    healthDistribution: [],
    taxBands: [],
    largeEstateExposures: [],
    staleDocumentClients: [],
    unplannedExposureClients: [],
    openConflictClients: [],
    totalClients: 0,
    averageHealthScore: null,
    totalProjectedTax: 0,
  }
}

// ─── Charitable impact calculator ────────────────────────────────────────────

export type GiftType = 'outright_gift' | 'daf_contribution' | 'crt'

export interface CharitableImpactResult {
  gift_type: GiftType
  gift_amount: number
  income_tax_deduction_pv: number
  estate_tax_savings: number
  charitable_impact_20yr: number
  net_cost_to_donor: number
}

export function calculateCharitableImpact(
  householdId: string,
  giftAmount: number,
  giftType: GiftType,
  effectiveEstateTaxRate: number = 0.40,
  effectiveIncomeTaxRate: number = 0.37,
  _discountRate: number = 0.05,
  nonprofitReturnRate: number = 0.07,
): CharitableImpactResult {
  void householdId
  void _discountRate

  // Income tax deduction PV
  const incomeTaxDeductionPV = giftAmount * effectiveIncomeTaxRate * (
    giftType === 'crt' ? 0.6 : 1.0 // CRT gets partial deduction
  )

  // Estate tax savings — gift removes from gross estate
  const estateTaxSavings = giftAmount * effectiveEstateTaxRate

  // Charitable impact over 20 years vs waiting until death
  // Invested now at nonprofit return rate
  const investedNow = giftAmount * Math.pow(1 + nonprofitReturnRate, 20)
  // Same amount passing through estate at death (with estate tax applied)
  const afterEstateTax = giftAmount * (1 - effectiveEstateTaxRate)
  const investedAtDeath = afterEstateTax * Math.pow(1 + nonprofitReturnRate, 10) // assume 10yr avg
  const charitableImpact20yr = investedNow - investedAtDeath

  // Net cost to donor after tax benefits
  const netCost = giftAmount - incomeTaxDeductionPV - estateTaxSavings

  return {
    gift_type: giftType,
    gift_amount: giftAmount,
    income_tax_deduction_pv: Math.round(incomeTaxDeductionPV),
    estate_tax_savings: Math.round(estateTaxSavings),
    charitable_impact_20yr: Math.round(charitableImpact20yr),
    net_cost_to_donor: Math.round(Math.max(0, netCost)),
  }
}
