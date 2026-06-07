/**
 * Smoke verification for four-surface polish sprint.
 * Run: dotenv -e .env.local -- npx tsx scripts/verify-four-surface-polish.ts
 */

import { createClient } from '@supabase/supabase-js'
import { buildAdvisorExportPayloads } from '@/lib/advisor/exportMappers'
import { generatePDFHTML } from '@/lib/export/generatePDFReport'
import { normalizePdfFilingStatus } from '@/lib/export/pdfFilingStatus'
import { mapAdvisorClientDatasets } from '@/lib/advisor/mappers'
import { mapHealthComponentsForPdf } from '@/lib/advisor/advisorBriefHelpers'
import { advisorDatasetIncludeForTab } from '@/lib/advisor/loaders'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { buildAdvisorStrategyViewModels } from '@/lib/advisor/strategyMappers'
import { latestFederalBracketsFromRows } from '@/lib/tax/federalExportTax'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key)

async function findVoelsClient(): Promise<{ clientId: string; advisorId: string; label: string } | null> {
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .or('full_name.ilike.%voel%,email.ilike.%voel%')
    .limit(10)

  for (const p of profiles ?? []) {
    const { data: link } = await admin
      .from('advisor_clients')
      .select('advisor_id, status')
      .eq('client_id', p.id)
      .in('status', ['active', 'connected'])
      .maybeSingle()
    if (link?.advisor_id) {
      return {
        clientId: p.id,
        advisorId: link.advisor_id,
        label: p.full_name ?? p.email ?? p.id,
      }
    }
  }

  // Fallback: e2e Johnson client
  const advisorEmail = process.env.PLAYWRIGHT_ADVISOR_EMAIL ?? process.env.SEED_ADVISOR_EMAIL
  const clientEmail = process.env.SEED_CLIENT_EMAIL ?? process.env.PLAYWRIGHT_CONSUMER_EMAIL
  if (advisorEmail && clientEmail) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const advisor = users.users.find((u) => u.email === advisorEmail)
    const client = users.users.find((u) => u.email === clientEmail)
    if (advisor && client) {
      return { clientId: client.id, advisorId: advisor.id, label: clientEmail }
    }
  }

  return null
}

function extractAssetBreakdownRows(html: string): string[] {
  const section = html.match(/Asset Breakdown[\s\S]*?<\/table>/i)?.[0] ?? ''
  const rows = [...section.matchAll(/<tr><td>([^<]+)<\/td><td>\$[^<]+<\/td><td>[^<]+<\/td><\/tr>/g)]
  return rows.map((m) => m[1])
}

function extractHealthLabels(html: string): string[] {
  const section = html.match(/Plan Health Score Components[\s\S]*?(?=<div class="footer">)/i)?.[0] ?? ''
  return [...section.matchAll(/<span>([^<]+)<\/span>\s*<span>\d+\/\d+<\/span>/g)].map((m) => m[1])
}

async function main() {
  const target = await findVoelsClient()
  if (!target) {
    console.error('No Voels (or e2e) client/advisor pair found')
    process.exit(1)
  }

  console.log(`\nTarget: ${target.label} (client ${target.clientId.slice(0, 8)}…)\n`)

  const { data: household } = await admin
    .from('households')
    .select(
      'id, owner_id, has_spouse, person1_first_name, person1_last_name, person2_first_name, person2_last_name, state_primary, filing_status, person1_birth_year, person2_birth_year, inflation_rate, growth_rate_accumulation, growth_rate_retirement, base_case_scenario_id',
    )
    .eq('owner_id', target.clientId)
    .maybeSingle()

  if (!household) {
    console.error('No household for client')
    process.exit(1)
  }

  const currentYear = new Date().getFullYear()
  const include = advisorDatasetIncludeForTab('meeting-prep')

  async function fetchHealthScoreAdmin(householdId: string) {
    const { data } = await admin
      .from('estate_health_scores')
      .select('score, computed_at, component_scores')
      .eq('household_id', householdId)
      .maybeSingle()
    if (!data) return { score: null, computedAt: null, components: [] as Array<{ label: string; score: number; maxScore: number }> }
    return {
      score: data.score,
      computedAt: data.computed_at ?? null,
      components: mapHealthComponentsForPdf(
        data.component_scores as Record<string, { label?: string; score?: number; maxScore?: number }> | null,
      ),
    }
  }

  const [
    assetsResult,
    realEstateResult,
    beneficiariesResult,
    estateDocumentsResult,
    legalDocumentsResult,
    notesResult,
    estateTaxResult,
    scenarioResult,
    domicileAnalysisResult,
    domicileScheduleResult,
    businessesResult,
    liabilitiesResult,
    businessInterestsResult,
    insurancePoliciesResult,
    stateExemptionsResult,
    stateBracketsResult,
    stateTaxRulesAllYearsResult,
    stateIncomeTaxBracketsResult,
    strategyLineItemsResult,
    healthScoreResult,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    advisorProfile,
    monteCarloResults,
    scenarioHistoryForExport,
  ] = await Promise.all([
    admin.from('assets').select('id, name, type, value, owner, cost_basis, titling, liquidity, situs_state, created_at').eq('owner_id', target.clientId),
    admin.from('real_estate').select('id, name, property_type, current_value, purchase_price, mortgage_balance, monthly_payment, interest_rate, is_primary_residence, situs_state, owner').eq('owner_id', target.clientId),
    admin.from('asset_beneficiaries').select('id, full_name, relationship, allocation_pct, beneficiary_type, asset_id, real_estate_id, insurance_policy_id, business_id, created_at').eq('owner_id', target.clientId),
    admin.from('estate_documents').select('id, document_type, exists, confirmed_at, created_at').eq('owner_id', target.clientId),
    admin.from('legal_documents').select('id, document_type, exists, confirmed_at, created_at').eq('owner_id', target.clientId),
    admin.from('advisor_notes').select('*').eq('client_id', target.clientId).eq('advisor_id', target.advisorId).order('created_at', { ascending: false }),
    admin.from('estate_tax').select('*').eq('owner_id', target.clientId).maybeSingle(),
    household.base_case_scenario_id
      ? admin.from('projection_scenarios').select('*').eq('id', household.base_case_scenario_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    Promise.resolve({ data: null, error: null }),
    Promise.resolve({ data: [], error: null }),
    admin.from('businesses').select('id, name, entity_type, ownership_pct, estimated_value, owner_estimated_value, valuation_method, has_buy_sell_agreement, buy_sell_funded, has_key_person_insurance, succession_plan, dloc_pct, dlom_pct, estate_inclusion_status').eq('owner_id', target.clientId),
    admin.from('liabilities').select('id, type, balance, owner').eq('owner_id', target.clientId),
    Promise.resolve({ data: [], error: null }),
    admin.from('insurance_policies').select('id, insurance_type, provider, policy_name, death_benefit, cash_value, annual_premium, is_ilit, is_employer_provided, estate_inclusion_status').eq('user_id', target.clientId),
    admin.from('state_estate_tax_exemptions').select('*').eq('state', household.state_primary ?? 'WA').eq('tax_year', currentYear).maybeSingle(),
    admin.from('state_estate_tax_rules').select('min_amount, max_amount, rate_pct, exemption_amount').eq('state', household.state_primary ?? 'WA').eq('tax_year', currentYear).order('min_amount', { ascending: true }),
    Promise.resolve({ data: [], error: null }),
    Promise.resolve({ data: [], error: null }),
    admin.from('strategy_line_items').select('id, strategy_source, source_role, amount, sign, confidence_level, effective_year, is_active, consumer_accepted, consumer_rejected, consumer_withdrawn, withdrawn_at, reversal_reason, reversed_from').eq('household_id', household.id).or('is_active.eq.true,and(consumer_withdrawn.eq.true,is_active.eq.false)'),
    fetchHealthScoreAdmin(household.id),
    (async () => {
      const { data } = await admin.from('assets').select('value').eq('owner_id', target.clientId).eq('liquidity', 'liquid')
      return (data ?? []).reduce((sum, a) => sum + (Number(a.value) || 0), 0)
    })(),
    (async () => {
      const { data } = await admin.from('strategy_configs').select('strategy_type, label').eq('household_id', household.id).eq('is_active', true)
      return (data ?? []).map((s) => s.label || s.strategy_type)
    })(),
    (async () => {
      const { data } = await admin
        .from('household_alerts')
        .select('id, title, description, severity, created_at')
        .eq('household_id', household.id)
        .is('resolved_at', null)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []).map((a) => ({
        id: a.id,
        title: (a.title || '').trim() || 'Alert',
        message: (a.description || a.title || '').trim() || 'Alert',
        severity: a.severity ?? 'info',
        created_at: a.created_at,
      }))
    })(),
    (async () => {
      const { data } = await admin.from('profiles').select('full_name, email, firm_name, phone, firm_logo_url').eq('id', target.advisorId).maybeSingle()
      return {
        full_name: data?.full_name ?? null,
        email: data?.email ?? null,
        firm_name: (data as { firm_name?: string | null } | null)?.firm_name ?? null,
        phone: (data as { phone?: string | null } | null)?.phone ?? null,
        firm_logo_url: (data as { firm_logo_url?: string | null } | null)?.firm_logo_url ?? null,
      }
    })(),
    (async () => {
      const name = (await admin.from('profiles').select('full_name, email').eq('id', target.advisorId).maybeSingle()).data
      const n = (name?.full_name || '').trim()
      if (n) return n
      return name?.email?.split('@')[0] ?? ''
    })(),
    Promise.resolve(null),
    Promise.resolve([]),
  ])

  const datasetsBundle = {
    assetsResult,
    realEstateResult,
    beneficiariesResult,
    estateDocumentsResult,
    legalDocumentsResult,
    notesResult,
    estateTaxResult,
    scenarioResult,
    domicileAnalysisResult,
    domicileScheduleResult,
    businessesResult,
    liabilitiesResult,
    businessInterestsResult,
    insurancePoliciesResult,
    stateExemptionsResult,
    stateBracketsResult,
    stateTaxRulesAllYearsResult,
    stateIncomeTaxBracketsResult,
    strategyLineItemsResult,
    beneficiaryGrantsResult: { data: [], error: null },
    healthScore: healthScoreResult.score,
    healthScoreComputedAt: healthScoreResult.computedAt,
    healthScoreComponents: healthScoreResult.components,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    advisorProfile,
    monteCarloResults,
    scenarioHistoryForExport,
  }

  const mapped = mapAdvisorClientDatasets({
    assetsResult: datasetsBundle.assetsResult,
    realEstateResult: datasetsBundle.realEstateResult,
    beneficiariesResult: datasetsBundle.beneficiariesResult,
    estateDocumentsResult: datasetsBundle.estateDocumentsResult,
    legalDocumentsResult: datasetsBundle.legalDocumentsResult,
    notesResult: datasetsBundle.notesResult,
    estateTaxResult: datasetsBundle.estateTaxResult,
    scenarioResult: datasetsBundle.scenarioResult,
    domicileAnalysisResult: datasetsBundle.domicileAnalysisResult,
    domicileScheduleResult: datasetsBundle.domicileScheduleResult,
    businessesResult: datasetsBundle.businessesResult,
    liabilitiesResult: datasetsBundle.liabilitiesResult,
    businessInterestsResult: datasetsBundle.businessInterestsResult,
    insurancePoliciesResult: datasetsBundle.insurancePoliciesResult,
    stateExemptionsResult: datasetsBundle.stateExemptionsResult,
    stateBracketsResult: datasetsBundle.stateBracketsResult,
    stateTaxRulesAllYearsResult: datasetsBundle.stateTaxRulesAllYearsResult,
    stateIncomeTaxBracketsResult: datasetsBundle.stateIncomeTaxBracketsResult,
    strategyLineItemsResult: datasetsBundle.strategyLineItemsResult,
    beneficiaryGrantsResult: datasetsBundle.beneficiaryGrantsResult,
  })

  const [{ data: federalBracketRows }, giftingSummaryRes] = await Promise.all([
    admin
      .from('federal_estate_tax_brackets')
      .select('tax_year, min_amount, max_amount, rate_pct')
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true }),
    admin.rpc('calculate_gifting_summary', { p_household_id: household.id }),
  ])
  const lifetimeGiftsUsed = Math.max(
    0,
    Number((giftingSummaryRes.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ?? 0),
  )
  const federalBrackets = latestFederalBracketsFromRows(federalBracketRows ?? [])

  const estateComposition = await getCachedComposition(admin, household.id, 'consumer', lifetimeGiftsUsed)
  const strategyVm = buildAdvisorStrategyViewModels({
    currentYear,
    household,
    stateBrackets: mapped.stateBrackets,
    estateCompositionGrossEstate: Number(estateComposition?.gross_estate ?? 0),
    lifetimeGiftsUsed,
    scenario: mapped.scenario,
    scenarioOutputs: mapped.scenarioOutputs,
    scenarioOutputsSecondDeath: mapped.scenarioOutputsSecondDeath,
    latestOutput: mapped.latestOutput,
    assumptionSnapshot: mapped.assumptionSnapshot,
    strategyLineItems: mapped.strategyLineItems,
  })

  const grossForExport = Number(mapped.latestOutput?.estate_incl_home ?? 0)

  const { data: priorScoreRow } = await admin
    .from('estate_health_scores')
    .select('score')
    .eq('household_id', household.id)
    .order('computed_at', { ascending: false })
    .range(1, 1)

  const narrativeFields = {
    filingStatus: normalizePdfFilingStatus(household.filing_status),
    domicileState: household.state_primary ?? 'WA',
    hasTrust: false,
    hasIrrevocableTrust: false,
    hasBypassTrust: false,
    hasGiftingProgram: false,
    lifeInsuranceOutsideILIT: 0,
    priorHealthScore: priorScoreRow?.[0]?.score ?? undefined,
    sunsetTaxEstimate: 0,
    annualGiftingCapacity: normalizePdfFilingStatus(household.filing_status) === 'mfj' ? 38_000 : 19_000,
    lifetimeExemptionRemaining: 0,
  }

  const payloads = await buildAdvisorExportPayloads({
    household,
    scenarioId: household.base_case_scenario_id,
    advisorDisplayName: datasetsBundle.advisorDisplayName,
    advisorProfile: datasetsBundle.advisorProfile,
    healthScore: datasetsBundle.healthScore,
    healthScoreComponents: datasetsBundle.healthScoreComponents,
    liquidAssets: datasetsBundle.liquidAssets,
    activeStrategies: datasetsBundle.activeStrategies,
    actionItems: datasetsBundle.actionItems,
    monteCarloResults: datasetsBundle.monteCarloResults,
    scenarioHistoryForExport: datasetsBundle.scenarioHistoryForExport,
    scenarioOutputs: mapped.scenarioOutputs,
    latestOutput: mapped.latestOutput,
    assumptionSnapshot: mapped.assumptionSnapshot,
    scenarioForStrategy: strategyVm.scenarioForStrategy,
    narrativeFields,
    stateBrackets: mapped.stateBrackets,
    federalBrackets,
    lifetimeGiftsUsed,
    assets: mapped.assets,
    realEstate: mapped.realEstate,
    businesses: mapped.businesses,
    businessInterests: mapped.businessInterests,
    insurancePolicies: mapped.insurancePolicies,
    compositionFallback: estateComposition
      ? {
          inside_financial: estateComposition.inside_financial,
          inside_real_estate: estateComposition.inside_real_estate,
          inside_business_gross: estateComposition.inside_business_gross,
          inside_insurance: estateComposition.inside_insurance,
        }
      : null,
  })

  const pdf = payloads.exportPdfData
  console.log('=== PDF payload (page 2 inputs) ===')
  console.log(`assetBreakdown rows: ${pdf.assetBreakdown.length}`)
  pdf.assetBreakdown.forEach((r) => console.log(`  - ${r.label}: $${r.value.toLocaleString()} (${(r.pct * 100).toFixed(1)}%)`))
  console.log(`healthComponents: ${pdf.healthComponents.length}`)
  pdf.healthComponents.forEach((c) => console.log(`  - ${c.label}: ${c.score}/${c.maxScore}`))

  const html = generatePDFHTML(pdf)
  const assetRows = extractAssetBreakdownRows(html)
  const healthLabels = extractHealthLabels(html)

  console.log('\n=== PDF HTML (page 2 rendered) ===')
  if (assetRows.length > 0) {
    console.log(`Asset table rows: ${assetRows.join(', ')}`)
  } else if (html.includes('No asset category data available')) {
    console.log('Asset table: empty-state message shown')
  } else {
    console.log('Asset table: HEADERS ONLY (no data rows)')
  }

  if (healthLabels.length > 0) {
    console.log(`Health bars: ${healthLabels.join(', ')}`)
  } else if (html.includes('Health score components not yet calculated')) {
    console.log('Health bars: empty-state message shown')
  } else {
    console.log('Health bars: NONE')
  }

  console.log('\n=== Brief route markers (static grep) ===')
  const routeSrc = await import('fs/promises').then((fs) =>
    fs.readFile('app/api/advisor/meeting-prep-pdf/[clientId]/route.ts', 'utf8'),
  )
  for (const marker of ['Suggested agenda', 'formatAlertsForBrief', 'deriveAgenda', 'engagementLabel']) {
    console.log(`  ${marker}: ${routeSrc.includes(marker) ? 'YES' : 'NO'}`)
  }

  console.log('\n=== Modal seed markers (MeetingPrepTab) ===')
  const tabSrc = await import('fs/promises').then((fs) =>
    fs.readFile('app/advisor/clients/[clientId]/_tabs/MeetingPrepTab.tsx', 'utf8'),
  )
  for (const marker of ['formatAlertsForBrief', 'health_score_last_meeting', 'meetingBriefPrintUrl', 'dollarImpact']) {
    console.log(`  ${marker}: ${tabSrc.includes(marker) ? 'YES' : 'NO'}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
