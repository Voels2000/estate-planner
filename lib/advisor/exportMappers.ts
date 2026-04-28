import { displayPersonFirstName } from '@/lib/display-person-name'
import type { PDFReportData } from '@/lib/export/generatePDFReport'
import type { ExcelExportData } from '@/lib/export/generateExcelExport'
import type { ExportProjectionRow, TaxSummaryExport } from '@/components/advisor/ExportPanel'
import type { ActionItem, MonteCarloSummary, ScenarioVersion } from '@/lib/export-wiring'
import type { AdvisorExportPanelProps } from '@/lib/advisor/types'

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

export function buildAdvisorExportPayloads(params: {
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
  advisorDisplayName: string | null
  healthScore: number | null
  liquidAssets: number
  activeStrategies: string[]
  actionItems: ActionItem[]
  monteCarloResults: MonteCarloSummary | null
  scenarioHistoryForExport: ScenarioVersion[]
  scenarioOutputs: Array<Record<string, unknown>>
  latestOutput: Record<string, unknown> | null
  assumptionSnapshot: Record<string, unknown>
  scenarioForStrategy: { law_scenario?: 'current_law' | 'no_exemption' } | null
}): {
  exportPanelProps: AdvisorExportPanelProps
  exportPdfData: PDFReportData
  exportExcelData: ExcelExportData
} {
  const { household } = params
  const exportClientName = household.has_spouse
    ? `${household.person1_first_name} & ${household.person2_first_name} ${household.person1_last_name}`
    : `${household.person1_first_name} ${household.person1_last_name}`

  const reportDateStr = new Date().toLocaleDateString()
  const grossForExport = Number(params.latestOutput?.estate_incl_home ?? 0)
  const fedTaxExport = Number(
    params.latestOutput?.estate_tax_federal ??
      params.latestOutput?.federal_tax ??
      params.latestOutput?.federal_estate_tax ??
      0,
  )
  const stTaxExport = Number(
    params.latestOutput?.estate_tax_state ?? params.latestOutput?.state_tax ?? params.latestOutput?.state_estate_tax ?? 0,
  )
  const exemptionExport = Number(params.assumptionSnapshot.estate_exemption_individual ?? 15_000_000)
  const lawScenarioExport = params.scenarioForStrategy?.law_scenario ?? 'current_law'

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
    advisorName: params.advisorDisplayName || 'Your Advisor',
    firmName: 'MyWealthMaps',
    reportDate: reportDateStr,
    grossEstate: grossForExport,
    netWorth: Number(params.latestOutput?.net_worth ?? grossForExport),
    liquidAssets: params.liquidAssets,
    illiquidAssets: Math.max(0, grossForExport - params.liquidAssets),
    assetBreakdown: [],
    federalTax: fedTaxExport,
    stateTax: stTaxExport,
    federalExemption: exemptionExport,
    lawScenario: lawScenarioExport,
    healthScore: params.healthScore ?? 0,
    healthComponents: [],
    activeStrategies: params.activeStrategies.map((name) => ({
      name,
      estateReduction: 0,
      taxSavings: 0,
      notes: '',
    })),
    actionItems: params.actionItems.map((a) => ({
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
