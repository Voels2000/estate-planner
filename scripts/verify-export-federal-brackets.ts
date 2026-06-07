/**
 * Verify export federal tax uses progressive bracket engine (not flat 40%).
 * Run: dotenv -e .env.local -- npx tsx scripts/verify-export-federal-brackets.ts
 */

import { createClient } from '@supabase/supabase-js'
import { buildAdvisorExportPayloads } from '@/lib/advisor/exportMappers'
import { computeFederalEstateTax } from '@/lib/calculations/estate-tax'
import { generatePDFHTML } from '@/lib/export/generatePDFReport'
import {
  computeFederalExportTax,
  filingStatusForFederalTax,
  latestFederalBracketsFromRows,
} from '@/lib/tax/federalExportTax'
import { normalizePdfFilingStatus } from '@/lib/export/pdfFilingStatus'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key)

function extractPage3FederalTax(html: string): number | null {
  const match = html.match(/Federal Estate Tax<\/div>\s*<div class="metric-value"[^>]*>\$([^<]+)<\/div>/i)
  if (!match) return null
  return Number(match[1].replace(/,/g, ''))
}

async function main() {
  const { data: federalBracketRows } = await admin
    .from('federal_estate_tax_brackets')
    .select('tax_year, min_amount, max_amount, rate_pct')
    .order('tax_year', { ascending: false })
    .order('min_amount', { ascending: true })

  const brackets = latestFederalBracketsFromRows(federalBracketRows ?? [])
  if (brackets.length === 0) {
    console.error('FAIL: no federal_estate_tax_brackets rows')
    process.exit(1)
  }

  const grossForExport = 50_000_000
  const expected = computeFederalExportTax({
    grossEstate: grossForExport,
    filingStatus: 'married_joint',
    hasSpouse: true,
    brackets,
    lifetimeGiftsUsed: 0,
    lawScenario: 'current_law',
  })

  const direct = computeFederalEstateTax(
    grossForExport,
    0,
    0,
    filingStatusForFederalTax('married_joint'),
    brackets,
  )
  if (expected.federalTax !== direct.net_estate_tax) {
    console.error(
      `FAIL: computeFederalExportTax (${expected.federalTax}) !== computeFederalEstateTax (${direct.net_estate_tax})`,
    )
    process.exit(1)
  }

  const noExemption = computeFederalExportTax({
    grossEstate: grossForExport,
    filingStatus: 'married_joint',
    hasSpouse: true,
    brackets,
    lawScenario: 'no_exemption',
  })
  if (noExemption.federalExemption !== 0 || noExemption.federalTax <= expected.federalTax) {
    console.error('FAIL: no_exemption scenario should have zero exemption and higher tax than current_law')
    process.exit(1)
  }

  const household = {
    id: '00000000-0000-4000-8000-000000000001',
    has_spouse: true,
    person1_first_name: 'Verify',
    person1_last_name: 'Export',
    person2_first_name: 'Spouse',
    person2_last_name: 'Export',
    state_primary: 'WA',
    filing_status: 'married_joint',
    person1_birth_year: 1960,
    person2_birth_year: 1962,
    inflation_rate: 2.5,
    growth_rate_accumulation: 7,
    growth_rate_retirement: 5,
  }

  const latestOutput = {
    year: new Date().getFullYear(),
    estate_incl_home: grossForExport,
    net_to_heirs: grossForExport - expected.federalTax,
  }

  const narrativeFields = {
    filingStatus: normalizePdfFilingStatus(household.filing_status),
    domicileState: household.state_primary,
    hasTrust: false,
    hasIrrevocableTrust: false,
    hasBypassTrust: false,
    hasGiftingProgram: false,
    lifeInsuranceOutsideILIT: 0,
    sunsetTaxEstimate: 0,
    annualGiftingCapacity: 38_000,
    lifetimeExemptionRemaining: 0,
  }

  const payloads = await buildAdvisorExportPayloads({
    household,
    scenarioId: null,
    advisorDisplayName: 'Verify Script',
    healthScore: 70,
    liquidAssets: 0,
    activeStrategies: [],
    actionItems: [],
    monteCarloResults: null,
    scenarioHistoryForExport: [],
    scenarioOutputs: [latestOutput],
    latestOutput,
    assumptionSnapshot: {},
    scenarioForStrategy: { law_scenario: 'current_law' },
    narrativeFields,
    stateBrackets: [],
    federalBrackets: brackets,
    lifetimeGiftsUsed: 0,
  })

  const { exportPdfData, exportPanelProps, exportExcelData } = payloads

  if (exportPdfData.federalTax !== expected.federalTax) {
    console.error(
      `FAIL: export federal ${exportPdfData.federalTax} !== expected bracket ${expected.federalTax}`,
    )
    process.exit(1)
  }

  if (exportPanelProps.taxSummary?.federal_tax_current !== exportPdfData.federalTax) {
    console.error('FAIL: export panel federal !== PDF federal')
    process.exit(1)
  }
  if (exportExcelData.taxScenarios[0]?.federalTax !== exportPdfData.federalTax) {
    console.error('FAIL: Excel federal !== PDF federal')
    process.exit(1)
  }

  const page3Fed = extractPage3FederalTax(generatePDFHTML(exportPdfData))
  if (page3Fed !== exportPdfData.federalTax) {
    console.error(`FAIL: PDF page 3 federal ${page3Fed} !== payload ${exportPdfData.federalTax}`)
    process.exit(1)
  }

  console.log('PASS: export federal bracket engine')
  console.log(`  brackets: ${brackets.length} rows`)
  console.log(`  current_law federalTax: $${Math.round(exportPdfData.federalTax).toLocaleString()}`)
  console.log(`  no_exemption federalTax: $${Math.round(noExemption.federalTax).toLocaleString()}`)
  console.log(`  exemption displayed: $${Math.round(exportPdfData.federalExemption).toLocaleString()}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
