import { displayPersonFirstName } from '@/lib/display-person-name'
import type { PDFReportData } from '@/lib/export/generatePDFReport'
import type { ExcelExportData } from '@/lib/export/generateExcelExport'
import type { ExportProjectionRow, TaxSummaryExport } from '@/components/advisor/ExportPanel'
import type { ActionItem, MonteCarloSummary, ScenarioVersion } from '@/lib/export-wiring'
import type { AdvisorExportPanelProps } from '@/lib/advisor/types'
import type { NarrativePdfFields } from '@/lib/export/fetchNarrativePdfFields'
import {
  calculateStateEstateTax,
  resolveActiveStateTax,
  isMFJFilingStatus,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'
import type { EstateTaxBracket } from '@/lib/calculations/estate-tax'
import { computeFederalExportTax } from '@/lib/tax/federalExportTax'
import { buildPdfAssetBreakdown, resolveAdvisorBranding } from '@/lib/advisor/advisorBriefHelpers'
import {
  buildBeneficiaryAccountGroups,
  type AssetBeneficiaryRow,
} from '@/lib/advisor/beneficiaryHelpers'
import type { AdvisorProfileRow, HealthScoreComponent } from '@/lib/export-wiring'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadScenarioMonteCarlo } from '@/lib/advisor/loadScenarioMonteCarlo'

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

export async function buildAdvisorExportPayloads(params: {
  household: {
    id: string
    has_spouse: boolean | null
    person1_first_name: string | null
    person1_last_name: string | null
    person2_first_name: string | null
    person2_last_name: string | null
    state_primary: string | null
    filing_status: string | null
    person1_birth_year: number | null
    person2_birth_year: number | null
    inflation_rate: number | null
    growth_rate_accumulation: number | null
    growth_rate_retirement: number | null
  }
  scenarioId: string | null
  supabase?: SupabaseClient
  advisorDisplayName: string | null
  healthScore: number | null
  liquidAssets: number
  activeStrategies: string[]
  actionItems: ActionItem[]
  monteCarloResults: MonteCarloSummary | null
  scenarioHistoryForExport: ScenarioVersion[]
  scenarioOutputs: Array<Record<string, unknown>>
  latestOutput: Record<string, unknown> | null
  todayGrossEstate?: number | null
  assumptionSnapshot: Record<string, unknown>
  scenarioForStrategy: { law_scenario?: 'current_law' | 'no_exemption' } | null
  narrativeFields: NarrativePdfFields
  stateBrackets: StateBracket[]
  federalBrackets?: EstateTaxBracket[]
  lifetimeGiftsUsed?: number
  beneficiaries?: AssetBeneficiaryRow[]
  assets?: Array<{
    id?: string
    name?: string | null
    type?: string | null
    value?: number | null
    owner?: string | null
  }>
  realEstate?: Array<{ id?: string; name?: string | null; current_value?: number | null }>
  businesses?: Array<{
    id?: string
    name?: string | null
    estimated_value?: number | null
    ownership_pct?: number | null
  }>
  businessInterests?: Array<{ fmv_estimated?: number | null; ownership_pct?: number | null }>
  insurancePolicies?: Array<{ id?: string; policy_name?: string | null; death_benefit?: number | null }>
  healthScoreComponents?: HealthScoreComponent[]
  advisorProfile?: AdvisorProfileRow
  meetingDate?: string
  compositionFallback?: {
    inside_financial?: number | null
    inside_real_estate?: number | null
    inside_business_gross?: number | null
    inside_insurance?: number | null
  } | null
}): Promise<{
  exportPanelProps: AdvisorExportPanelProps
  exportPdfData: PDFReportData
  exportExcelData: ExcelExportData
}> {
  const { household } = params
  const exportClientName = household.has_spouse
    ? `${household.person1_first_name} & ${household.person2_first_name} ${household.person1_last_name}`
    : `${household.person1_first_name} ${household.person1_last_name}`

  const reportDateStr = new Date().toLocaleDateString()
  const grossForExport =
    params.todayGrossEstate && params.todayGrossEstate > 0
      ? params.todayGrossEstate
      : Number(params.latestOutput?.estate_incl_home ?? 0)
  const lawScenarioExport = params.scenarioForStrategy?.law_scenario ?? 'current_law'

  const { federalTax: fedTaxExport, federalExemption: exemptionExport } = computeFederalExportTax({
    grossEstate: grossForExport,
    filingStatus: household.filing_status,
    hasSpouse: Boolean(household.has_spouse),
    brackets: params.federalBrackets ?? [],
    lifetimeGiftsUsed: params.lifetimeGiftsUsed ?? 0,
    lawScenario: lawScenarioExport,
  })

  // Engine B state tax (aligned with generatePDFReport page 3)
  const exportStateResult = calculateStateEstateTax(
    grossForExport,
    params.narrativeFields.domicileState ?? '',
    params.stateBrackets ?? [],
    isMFJFilingStatus(params.narrativeFields.filingStatus),
    false,
  )
  const stTaxExport = resolveActiveStateTax(
    exportStateResult,
    params.narrativeFields.hasBypassTrust ?? false,
  )

  const projectionRowsForExcel: Array<Record<string, number | string>> = params.scenarioOutputs.map((row) => {
    const out: Record<string, number | string> = {}
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'number') out[k] = v
      else if (typeof v === 'string') out[k] = v
      else if (v == null) out[k] = ''
      else out[k] = JSON.stringify(v)
    }
    return out
  })

  const taxSummaryForExport: TaxSummaryExport | null = params.latestOutput
    ? {
        federal_tax_current: fedTaxExport,
        state_tax: stTaxExport,
        state_name: String(household.state_primary ?? 'State'),
      }
    : null

  const liquidityShortfall =
    !!taxSummaryForExport &&
    params.liquidAssets > 0 &&
    params.liquidAssets < taxSummaryForExport.federal_tax_current + taxSummaryForExport.state_tax

  const branding = resolveAdvisorBranding(params.advisorProfile ?? {
    full_name: params.advisorDisplayName,
    email: null,
  })

  const assetBreakdown = buildPdfAssetBreakdown({
    assets: params.assets ?? [],
    realEstate: params.realEstate ?? [],
    businesses: params.businesses ?? [],
    businessInterests: params.businessInterests ?? [],
    insurancePolicies: params.insurancePolicies ?? [],
    compositionFallback: params.compositionFallback,
  })

  const person1Name = displayPersonFirstName(
    [household.person1_first_name, household.person1_last_name].filter(Boolean).join(' ').trim() || null,
  )
  const person2Name = household.has_spouse
    ? displayPersonFirstName(
        [household.person2_first_name, household.person2_last_name].filter(Boolean).join(' ').trim() || null,
      )
    : null

  const beneficiaryData =
    params.beneficiaries && params.beneficiaries.length > 0
      ? buildBeneficiaryAccountGroups({
          benRows: params.beneficiaries,
          assets: (params.assets ?? []).filter((a): a is { id: string } & typeof a => Boolean(a.id)),
          realEstate: (params.realEstate ?? []).filter((r): r is { id: string } & typeof r => Boolean(r.id)),
          insurance: (params.insurancePolicies ?? []).filter(
            (i): i is { id: string } & typeof i => Boolean(i.id),
          ),
          businesses: (params.businesses ?? []).filter((b): b is { id: string } & typeof b => Boolean(b.id)),
          person1Name,
          person2Name,
        })
      : undefined

  const healthComponents = (params.healthScoreComponents ?? []).map((c) => ({
    label: c.label,
    score: c.score,
    maxScore: c.maxScore,
  }))

  const projectionChartRows = params.scenarioOutputs
    .filter((r) => r.year != null)
    .map((r) => {
      const fedTax = Number(r.estate_tax_federal ?? 0)
      const stateTax = Number(r.estate_tax_state ?? 0)
      return {
        year: Number(r.year),
        age: Number(r.age_person1 ?? r.age_p1 ?? 0),
        gross: Number(r.estate_incl_home ?? 0),
        netToHeirs: Number(r.net_to_heirs ?? 0),
        fedTax,
        stateTax,
        totalTax: fedTax + stateTax,
      }
    })
    .sort((a, b) => a.year - b.year)

  // Load precomputed MC for chart bands (Phase 2C)
  const mcForChart =
    params.scenarioId && params.supabase
      ? await loadScenarioMonteCarlo(params.scenarioId, params.supabase)
      : null

  const projectionChartBands = mcForChart?.percentiles_by_year
    ? mcForChart.percentiles_by_year.map((pt) => ({
        year: pt.year,
        p10_gross: pt.p10_gross,
        p90_gross: pt.p90_gross,
        p10_net: pt.p10_net,
        p90_net: pt.p90_net,
      }))
    : null

  const meetingDate = params.meetingDate ?? new Date().toISOString()

  const exportPanelProps = {
    householdId: household.id,
    scenarioId: params.scenarioId ?? '',
    advisorName: params.advisorDisplayName || 'Your Advisor',
    healthScore: params.healthScore,
    liquidAssets: params.liquidAssets,
    activeStrategies: params.activeStrategies,
    actionItems: params.actionItems,
    projectionData: mapScenarioRowsForExport(params.scenarioOutputs),
    taxSummary: taxSummaryForExport,
    monteCarloRun: params.monteCarloResults !== null,
    monteCarloResults: params.monteCarloResults,
    liquidityShortfall,
    scenarioHistory: params.scenarioHistoryForExport,
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
    advisorName: branding.advisorName,
    firmName: branding.firmName,
    firmLogoUrl: branding.firmLogoUrl,
    advisorPhone: branding.advisorPhone,
    advisorEmail: branding.advisorEmail,
    reportDate: reportDateStr,
    meetingDate,
    grossEstate: grossForExport,
    netWorth: Number(params.latestOutput?.net_worth ?? grossForExport),
    liquidAssets: params.liquidAssets,
    illiquidAssets: Math.max(0, grossForExport - params.liquidAssets),
    assetBreakdown,
    beneficiaryData: beneficiaryData?.groups.length ? beneficiaryData : undefined,
    projectionChartRows,
    projectionChartBands,
    firstTaxYearP10: mcForChart?.first_tax_year_p10 ?? null,
    federalTax: fedTaxExport,
    stateTax: stTaxExport,
    federalExemption: exemptionExport,
    lawScenario: lawScenarioExport,
    stateBrackets: params.stateBrackets,
    healthScore: params.healthScore ?? 0,
    healthComponents,
    activeStrategies: params.activeStrategies.map((name) => ({
      name,
      estateReduction: 0,
      taxSavings: 0,
      notes: '',
    })),
    actionItems: params.actionItems.map((a) => ({
      id: a.id,
      title: a.title ?? a.message,
      message: a.message,
      body: a.message,
      severity: a.severity,
      created_at: a.created_at,
    })),
    ...params.narrativeFields,
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
        netToHeirs: Number(params.latestOutput?.net_to_heirs ?? 0),
      },
    ],
    strategies: [],
  }

  return {
    exportPanelProps,
    exportPdfData,
    exportExcelData,
  }
}
