import { redirect } from 'next/navigation'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { detectConflicts } from '@/lib/conflict-detector'
import { createClient } from '@/lib/supabase/server'
import type { DbStateExemption } from '@/lib/projection/stateRegistry'
import type { PDFReportData } from '@/lib/export/generatePDFReport'
import type { ExcelExportData } from '@/lib/export/generateExcelExport'
import type { BeneficiaryAccessGrant } from '@/lib/types/beneficiary-grant'
import {
  fetchActiveStrategies,
  fetchActionItems,
  fetchAdvisorDisplayName,
  fetchHealthScore,
  fetchLiquidAssets,
  fetchMonteCarloSummary,
  fetchScenarioHistoryForExport,
} from '@/lib/export-wiring'
import type { ExportProjectionRow, TaxSummaryExport } from '@/components/advisor/ExportPanel'
import ClientViewShell from './_client-view-shell'

function mapScenarioRowsForExport(rows: Array<Record<string, unknown>>): ExportProjectionRow[] {
  return rows.map((r) => ({
    year: Number(r.year ?? 0),
    age_p1: Number(r.age_person1 ?? r.age_p1 ?? 0),
    age_p2: r.age_person2 != null ? Number(r.age_person2) : null,
    gross_estate: Number(r.estate_incl_home ?? r.gross_estate ?? 0),
    federal_tax: Number(r.estate_tax_federal ?? r.federal_tax ?? r.estate_tax_fed ?? 0),
    state_tax: Number(r.estate_tax_state ?? r.state_tax ?? 0),
    net_to_heirs: Number(r.net_to_heirs ?? 0),
  }))
}

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
      person1_ss_pia, person2_ss_pia,
      person2_ss_benefit_62, person2_ss_benefit_67,
      last_recommendation_at, created_at, updated_at
    `)
    .eq('owner_id', clientId)
    .single()

  if (!household) redirect('/advisor')

  const scenarioId = household.base_case_scenario_id

  const currentYear = new Date().getFullYear()
  const projectionYears = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5]
  const statesToFetch = ['WA', 'NY', 'MA', 'OR', 'CT', 'AZ']

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
    healthScore,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    monteCarloResults,
    scenarioHistoryForExport,
    beneficiaryGrantsResult,
    conflictReport,
  ] = await Promise.all([
    supabase
      .from('assets')
      .select('id, name, type, value, owner, cost_basis, titling, liquidity, situs_state, created_at')
      .eq('owner_id', clientId),
    supabase
      .from('real_estate')
      .select('id, name, property_type, current_value, purchase_price, mortgage_balance, monthly_payment, interest_rate, is_primary_residence, situs_state, owner')
      .eq('owner_id', clientId),
    supabase
      .from('beneficiaries')
      .select('id, name, relationship, allocation_pct, account_type, contingent, created_at')
      .eq('owner_id', clientId),
    supabase
      .from('estate_documents')
      .select('id, document_type, exists, confirmed_at, created_at')
      .eq('owner_id', clientId),
    supabase
      .from('legal_documents')
      .select('id, document_type, file_name, uploader_role, version, is_current, created_at')
      .eq('household_id', household.id)
      .eq('is_current', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('advisor_notes')
      .select('id, content, created_at, updated_at')
      .eq('advisor_id', user.id)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    supabase.rpc('calculate_state_estate_tax', { p_household_id: household.id }),
    scenarioId
      ? supabase
          .from('projection_scenarios')
          .select('id, scenario_type, outputs, outputs_s1_first, assumption_snapshot')
          .eq('id', scenarioId)
          .single()
      : Promise.resolve({ data: null, error: null }),
    supabase
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
      .maybeSingle(),
    supabase
      .from('domicile_schedule')
      .select('*')
      .eq('household_id', household.id)
      .order('effective_year', { ascending: true }),
    supabase
      .from('businesses')
      .select('id, name, entity_type, ownership_pct, estimated_value, owner_estimated_value, valuation_method, has_buy_sell_agreement, buy_sell_funded, has_key_person_insurance, succession_plan')
      .eq('owner_id', clientId),
    supabase
      .from('liabilities')
      .select('id, type, balance, owner')
      .eq('owner_id', clientId),
    supabase
      .from('business_interests')
      .select('id, entity_name, fmv_estimated, total_entity_value, ownership_pct')
      .eq('owner_id', clientId),
    supabase
      .from('insurance_policies')
      .select('id, insurance_type, provider, policy_name, death_benefit, cash_value, annual_premium, is_ilit, is_employer_provided')
      .eq('user_id', clientId),
    supabase.rpc('get_state_exemptions', {
      p_states: statesToFetch,
      p_years: projectionYears,
    }),
    fetchHealthScore(household.id),
    fetchLiquidAssets(clientId),
    fetchActiveStrategies(household.id),
    fetchActionItems(household.id),
    fetchAdvisorDisplayName(user.id),
    scenarioId ? fetchMonteCarloSummary(scenarioId) : Promise.resolve(null),
    fetchScenarioHistoryForExport(household.id),
    supabase
      .from('beneficiary_access_grants')
      .select('*')
      .eq('household_id', household.id)
      .order('granted_at', { ascending: false }),
    detectConflicts(household.id, clientId).catch((e) => {
      console.error('[advisor-client-view] conflict detection failed:', e)
      return null
    }),
  ])

  const assets = assetsResult.data
  const realEstate = realEstateResult.data
  const beneficiaries = beneficiariesResult.data
  const estateDocuments = estateDocumentsResult.data
  const legalDocuments = legalDocumentsResult.data
  const notes = notesResult.data
  const estateTax = estateTaxResult.data ?? null
  const scenario = scenarioResult.data ?? null
  const domicileAnalysis = domicileAnalysisResult.data ?? null
  const domicileSchedule = domicileScheduleResult.data
  const businesses = businessesResult.data ?? []
  const liabilities = liabilitiesResult.data ?? []
  const businessInterests = businessInterestsResult.data ?? []
  const insurancePolicies = insurancePoliciesResult.data ?? []
  const stateExemptions = (stateExemptionsResult.data ?? []) as DbStateExemption[]
  const beneficiaryGrants = (beneficiaryGrantsResult.data ?? []) as BeneficiaryAccessGrant[]

  const domicileChecklist = domicileAnalysis?.id
    ? (
        await supabase
          .from('domicile_checklist_items')
          .select('*')
          .eq('analysis_id', domicileAnalysis.id)
          .order('priority', { ascending: false })
      ).data ?? []
    : []

  const scenarioOutputs = (
    scenario && Array.isArray(scenario.outputs_s1_first) && scenario.outputs_s1_first.length > 0
      ? scenario.outputs_s1_first
      : scenario && Array.isArray(scenario.outputs)
        ? scenario.outputs
        : []
  ) as Array<Record<string, unknown>>
  const latestOutput = scenarioOutputs.length > 0 ? scenarioOutputs[0] : null
  const assumptionSnapshot = (scenario?.assumption_snapshot ?? {}) as Record<string, unknown>

  const scenarioForStrategy = scenario
    ? {
        id: scenario.id,
        gross_estate: Number(latestOutput?.estate_incl_home ?? 0),
        federal_exemption: Number(assumptionSnapshot.estate_exemption_individual ?? 15_000_000),
        annual_rmd: Number(latestOutput?.income_rmd ?? 0),
        pre_ira_balance: Number(latestOutput?.assets_tax_deferred ?? 0),
        estimated_federal_tax: Number(
          latestOutput?.estate_tax_federal ??
          latestOutput?.federal_tax ??
          latestOutput?.federal_estate_tax ??
          0
        ),
        estimated_state_tax: Number(
          latestOutput?.estate_tax_state ??
          latestOutput?.state_tax ??
          latestOutput?.state_estate_tax ??
          0
        ),
        law_scenario: 'current_law' as 'current_law' | 'no_exemption',
      }
    : null

  const projectionRowsDomicile = scenarioOutputs.map((r) => ({
    year: Number(r.year ?? 0),
    gross_estate: Number(r.estate_incl_home ?? r.gross_estate ?? 0),
  }))

  const exportClientName = household.has_spouse
    ? `${household.person1_first_name} & ${household.person2_first_name} ${household.person1_last_name}`
    : `${household.person1_first_name} ${household.person1_last_name}`

  const reportDateStr = new Date().toLocaleDateString()
  const grossForExport = Number(latestOutput?.estate_incl_home ?? 0)
  const fedTaxExport = Number(
    latestOutput?.estate_tax_federal ?? latestOutput?.federal_tax ?? latestOutput?.federal_estate_tax ?? 0,
  )
  const stTaxExport = Number(
    latestOutput?.estate_tax_state ?? latestOutput?.state_tax ?? latestOutput?.state_estate_tax ?? 0,
  )
  const exemptionExport = Number(assumptionSnapshot.estate_exemption_individual ?? 15_000_000)
  const lawScenarioExport = scenarioForStrategy?.law_scenario ?? 'current_law'

  const projectionRowsForExcel: Array<Record<string, number | string>> = scenarioOutputs.map((row) => {
    const out: Record<string, number | string> = {}
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'number') out[k] = v
      else if (typeof v === 'string') out[k] = v
      else if (v == null) out[k] = ''
      else out[k] = JSON.stringify(v)
    }
    return out
  })

  const taxSummaryForExport: TaxSummaryExport | null = latestOutput
    ? {
        federal_tax_current: fedTaxExport,
        state_tax: stTaxExport,
        state_name: String(household.state_primary ?? 'State'),
      }
    : null

  const liquidityShortfall =
    !!taxSummaryForExport &&
    liquidAssets > 0 &&
    liquidAssets < taxSummaryForExport.federal_tax_current + taxSummaryForExport.state_tax

  const exportPanelProps = {
    householdId: household.id,
    scenarioId: scenarioId ?? '',
    advisorName: advisorDisplayName,
    healthScore,
    liquidAssets,
    activeStrategies,
    actionItems,
    projectionData: mapScenarioRowsForExport(scenarioOutputs),
    taxSummary: taxSummaryForExport,
    monteCarloRun: monteCarloResults !== null,
    monteCarloResults,
    liquidityShortfall,
    scenarioHistory: scenarioHistoryForExport,
  }

  const exportPdfData: PDFReportData = {
    householdId: household.id,
    clientName: exportClientName,
    person1Name: displayPersonFirstName(
      [household.person1_first_name, household.person1_last_name].filter(Boolean).join(' ').trim() || null,
    ),
    person2Name: household.has_spouse
      ? displayPersonFirstName(
          [household.person2_first_name, household.person2_last_name].filter(Boolean).join(' ').trim() || null,
        )
      : undefined,
    advisorName: advisorDisplayName || 'Your Advisor',
    firmName: 'MyWealthMaps',
    reportDate: reportDateStr,
    grossEstate: grossForExport,
    netWorth: Number(latestOutput?.net_worth ?? grossForExport),
    liquidAssets,
    illiquidAssets: Math.max(0, grossForExport - liquidAssets),
    assetBreakdown: [],
    federalTax: fedTaxExport,
    stateTax: stTaxExport,
    federalExemption: exemptionExport,
    lawScenario: lawScenarioExport,
    healthScore: healthScore ?? 0,
    healthComponents: [],
    activeStrategies: activeStrategies.map((name) => ({
      name,
      estateReduction: 0,
      taxSavings: 0,
      notes: '',
    })),
    actionItems: actionItems.map((a) => ({
      severity: a.severity,
      title: a.message,
      body: a.message,
    })),
  }

  const exportExcelData: ExcelExportData = {
    household: {
      name: exportClientName,
      person1Name: displayPersonFirstName(
        [household.person1_first_name, household.person1_last_name].filter(Boolean).join(' ').trim() || null,
      ),
      person2Name: household.has_spouse
        ? displayPersonFirstName(
            [household.person2_first_name, household.person2_last_name].filter(Boolean).join(' ').trim() || null,
          )
        : undefined,
      state: household.state_primary ?? '',
      filingStatus: household.filing_status ?? '',
      person1BirthYear: household.person1_birth_year ?? 1960,
      person2BirthYear: household.person2_birth_year ?? undefined,
    },
    assumptions: {
      grossEstate: grossForExport,
      federalExemption: exemptionExport,
      inflationRate: (Number(household.inflation_rate) || 2.5) / 100,
      growthRateAccumulation: (Number(household.growth_rate_accumulation) || 7) / 100,
      growthRateRetirement: (Number(household.growth_rate_retirement) || 5) / 100,
      lawScenario: lawScenarioExport,
      reportDate: reportDateStr,
    },
    projectionRows: projectionRowsForExcel,
    taxScenarios: [
      {
        scenario: 'Base case (current law)',
        exemption: exemptionExport,
        federalTax: fedTaxExport,
        stateTax: stTaxExport,
        totalTax: fedTaxExport + stTaxExport,
        netToHeirs: Number(latestOutput?.net_to_heirs ?? 0),
      },
    ],
    strategies: [],
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
      businesses={businesses}
      liabilities={liabilities}
      businessInterests={businessInterests}
      insurancePolicies={insurancePolicies}
      beneficiaries={beneficiaries ?? []}
      estateDocuments={estateDocuments ?? []}
      legalDocuments={legalDocuments ?? []}
      notes={notes ?? []}
      estateTax={estateTax}
      scenario={scenarioForStrategy}
      scenarioHistory={scenarioHistoryForExport}
      exportPdfData={exportPdfData}
      exportExcelData={exportExcelData}
      exportPanelProps={exportPanelProps}
      projectionRowsDomicile={projectionRowsDomicile}
      beneficiaryGrants={beneficiaryGrants}
      domicileAnalysis={domicileAnalysis ?? null}
      domicileSchedule={domicileSchedule ?? null}
      domicileChecklist={domicileChecklist}
      stateExemptions={stateExemptions}
      conflictReport={conflictReport}
    />
  )
}
