// Sprint 73 — Excel Export Generator
// Generates advisor-grade .xlsx export using SheetJS (xlsx package)
//
// Sheets:
// 1. Assumptions — all input values (not formulas, values only per spec)
// 2. Projection — year-by-year projection rows from outputs_s1_first
// 3. Tax Analysis — federal and state tax scenarios
// 4. Strategies — active strategy configs and outputs
// 5. Monte Carlo — percentile results (if available)
//
// Per sprint plan: "Excel export with Assumptions sheet — values only"
// No formulas in any sheet — all cells contain static values

export interface ExcelExportData {
  household: {
    name: string
    person1Name: string
    person2Name?: string
    state: string
    filingStatus: string
    person1BirthYear: number
    person2BirthYear?: number
  }
  assumptions: {
    grossEstate: number
    federalExemption: number
    inflationRate: number
    growthRateAccumulation: number
    growthRateRetirement: number
    lawScenario: string
    reportDate: string
  }
  projectionRows: Array<Record<string, number | string>>
  taxScenarios: Array<{
    scenario: string
    exemption: number
    federalTax: number
    stateTax: number
    totalTax: number
    netToHeirs: number
  }>
  strategies: Array<{
    name: string
    type: string
    estateReduction: number
    taxSavings: number
    config: Record<string, number | string>
  }>
  monteCarlo?: {
    p10Estate: number
    p25Estate: number
    p50Estate: number
    p75Estate: number
    p90Estate: number
    p10Tax: number
    p50Tax: number
    p90Tax: number
    successRate: number
    medianNetToHeirs: number
    simulationCount: number
    runDate: string
  }
}

// Generate Excel workbook data as a structured object
// Actual xlsx file creation happens client-side using SheetJS
export function buildExcelWorkbook(data: ExcelExportData) {
  const workbook = {
    SheetNames: ['Assumptions', 'Projection', 'Tax Analysis', 'Strategies'],
    Sheets: {} as Record<string, unknown>,
  }

  if (data.monteCarlo) {
    workbook.SheetNames.push('Monte Carlo')
  }

  // Sheet 1: Assumptions (values only — no formulas)
  const assumptionsRows = [
    ['Estate Planning Report — Assumptions', ''],
    ['Generated', data.assumptions.reportDate],
    ['', ''],
    ['HOUSEHOLD', ''],
    ['Client Name', data.household.name],
    ['Person 1', data.household.person1Name],
    ['Person 2', data.household.person2Name ?? 'N/A'],
    ['State', data.household.state],
    ['Filing Status', data.household.filingStatus],
    ['Person 1 Birth Year', data.household.person1BirthYear],
    ['Person 2 Birth Year', data.household.person2BirthYear ?? 'N/A'],
    ['', ''],
    ['PROJECTION ASSUMPTIONS', ''],
    ['Gross Estate', data.assumptions.grossEstate],
    ['Federal Exemption', data.assumptions.federalExemption],
    ['Law Scenario', data.assumptions.lawScenario],
    ['Inflation Rate', data.assumptions.inflationRate],
    ['Growth Rate (Accumulation)', data.assumptions.growthRateAccumulation],
    ['Growth Rate (Retirement)', data.assumptions.growthRateRetirement],
    ['', ''],
    ['NOTE', 'All values are static. No formulas are used in this workbook.'],
  ]

  // Sheet 2: Projection rows
  const projectionHeaders = data.projectionRows.length > 0
    ? Object.keys(data.projectionRows[0])
    : ['year', 'estate_incl_home', 'assets_total', 'estate_tax_federal', 'estate_tax_state', 'net_to_heirs']

  const projectionRows = [
    projectionHeaders,
    ...data.projectionRows.map(row => projectionHeaders.map(h => row[h] ?? 0)),
  ]

  // Sheet 3: Tax Analysis
  const taxRows = [
    ['Scenario', 'Federal Exemption', 'Federal Tax', 'State Tax', 'Total Tax', 'Net to Heirs'],
    ...data.taxScenarios.map(s => [
      s.scenario,
      s.exemption,
      s.federalTax,
      s.stateTax,
      s.totalTax,
      s.netToHeirs,
    ]),
  ]

  // Sheet 4: Strategies
  const strategyRows = [
    ['Strategy', 'Type', 'Estate Reduction', 'Tax Savings'],
    ...data.strategies.map(s => [s.name, s.type, s.estateReduction, s.taxSavings]),
  ]

  // Sheet 5: Monte Carlo (if available)
  const mcRows = data.monteCarlo ? [
    ['Monte Carlo Results', ''],
    ['Simulation Count', data.monteCarlo.simulationCount],
    ['Run Date', data.monteCarlo.runDate],
    ['', ''],
    ['Metric', 'Value'],
    ['P10 Estate', data.monteCarlo.p10Estate],
    ['P25 Estate', data.monteCarlo.p25Estate],
    ['P50 Estate (Median)', data.monteCarlo.p50Estate],
    ['P75 Estate', data.monteCarlo.p75Estate],
    ['P90 Estate', data.monteCarlo.p90Estate],
    ['P10 Tax', data.monteCarlo.p10Tax],
    ['P50 Tax (Median)', data.monteCarlo.p50Tax],
    ['P90 Tax', data.monteCarlo.p90Tax],
    ['Tax-Free Rate', `${data.monteCarlo.successRate}%`],
    ['Median Net to Heirs', data.monteCarlo.medianNetToHeirs],
  ] : []

  return {
    workbook,
    sheets: {
      Assumptions: assumptionsRows,
      Projection: projectionRows,
      'Tax Analysis': taxRows,
      Strategies: strategyRows,
      ...(data.monteCarlo ? { 'Monte Carlo': mcRows } : {}),
    },
  }
}
