// Sprint 73 — Advisor PDF Report Generator
// Generates a 7-page conditional advisor-grade estate planning report
// Uses browser print (HTML) for PDF generation
//
// 7 conditional pages:
// 1. Cover page — household summary, health score, advisor branding
// 2. Estate snapshot — gross estate, net worth, asset breakdown
// 3. Federal & state tax analysis — waterfall, scenarios
// 4. Strategy summary — active strategies and projected savings
// 5. Monte Carlo results — fan chart, P10/P50/P90 outcomes (if run)
// 6. Liquidity analysis — coverage ratio, shortfall, recommendations (if applicable)
// 7. Action items — open alerts, recommendations, next steps
//
// Page is CONDITIONAL — only included if relevant data exists

import type { ActionItem } from '@/lib/export-wiring'
import {
  calculateStateTaxScenarios,
  getStateDisplayName,
  isMFJFilingStatus,
  resolveActiveStateTax,
  calculateStateEstateTax,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'
import type { BeneficiarySummary } from '@/lib/advisor/beneficiaryHelpers'
import {
  dedupeActionItems,
  enrichActionItems,
  generateExecutiveSummary,
  generateGiftingSummary,
  generateHealthTrend,
  generateTaxCallout,
  groupActionItems,
} from './narrativeEngine'

const STATE_PORTABILITY_NOTES: Record<string, string> = {
  WA: 'Washington does not allow portability of its estate tax exemption. Without a credit shelter trust funded at first death, the first spouse\'s $3M exemption is permanently lost. The surviving spouse receives only their own $3M exemption on second death.',
  OR: 'Oregon does not allow portability of its estate tax exemption. At Oregon\'s $1M threshold, a bypass trust is critical for nearly every married estate over $1M.',
  MN: 'Minnesota does not allow portability of its estate tax exemption. A bypass trust preserves both spouses\' $3M exemptions across both deaths.',
  MA: 'Massachusetts does not allow portability and applies a cliff tax: once the estate exceeds $2M, the entire estate is taxed. A bypass trust both preserves the first-death exemption and keeps the survivor\'s estate below the cliff.',
  IL: 'Illinois does not allow portability of its estate tax exemption. A bypass trust preserves both spouses\' $4M exemptions.',
  NY: 'New York does not allow portability and applies a cliff tax at 105% of the exemption: if the estate exceeds this threshold, the entire estate is taxed at full rates. Precise planning is critical.',
}

export interface PDFReportData {
  // Household
  householdId: string
  clientName: string
  person1Name: string
  person2Name?: string
  advisorName: string
  firmName: string
  advisorPhone?: string
  advisorEmail?: string
  reportDate: string
  meetingDate?: string

  // Estate snapshot
  grossEstate: number
  netWorth: number
  liquidAssets: number
  illiquidAssets: number
  assetBreakdown: Array<{ label: string; value: number; pct: number }>
  /** Beneficiary summary from asset_beneficiaries (optional page). */
  beneficiaryData?: BeneficiarySummary
  /** Simplified projection rows for estate snapshot chart (from outputs_s1_first). */
  projectionChartRows: Array<{
    year: number
    age: number
    gross: number
    netToHeirs: number
    fedTax: number
    stateTax: number
    totalTax: number
  }>

  // Tax analysis
  federalTax: number
  stateTax: number
  federalExemption: number
  lawScenario: string
  stateBrackets: StateBracket[]
  hasBypassTrust?: boolean

  // Health score
  healthScore: number
  healthComponents: Array<{ label: string; score: number; maxScore: number }>

  // Strategies (from strategy_configs)
  activeStrategies: Array<{
    name: string
    estateReduction: number
    taxSavings: number
    notes: string
  }>

  // Monte Carlo (optional — page 5 only if run)
  monteCarlo?: {
    p10Tax: number
    p50Tax: number
    p90Tax: number
    successRate: number
    medianNetToHeirs: number
    runDate: string
  }

  // Liquidity (optional — page 6 only if shortfall)
  liquidity?: {
    coverageRatio: number
    shortfall: number
    recommendedILIT: number
  }

  // Action items (from household_alerts)
  actionItems: ActionItem[]

  // Narrative engine inputs
  filingStatus: 'mfj' | 'single' | 'widow'
  domicileState: string
  hasTrust: boolean
  hasIrrevocableTrust: boolean
  hasGiftingProgram: boolean
  lifeInsuranceOutsideILIT: number
  priorHealthScore?: number
  sunsetTaxEstimate?: number
  annualGiftingCapacity: number
  lifetimeExemptionRemaining: number
}

export interface PDFGenerationResult {
  success: boolean
  pageCount: number
  includedPages: string[]
  error?: string
}

// Page inclusion logic
export function determinePDFPages(data: PDFReportData): string[] {
  const pages: string[] = []

  // Page 1: Always included
  pages.push('cover')

  // Page 2: Always included
  pages.push('estate_snapshot')

  if (data.beneficiaryData && data.beneficiaryData.groups.length > 0) {
    pages.push('beneficiary_summary')
  }

  // Tax analysis (page 3 or 4 when beneficiaries present)
  pages.push('tax_analysis')

  // Page 4: Always included — shows empty state when no active strategies
  pages.push('strategy_summary')

  // Page 5: Include if Monte Carlo has been run
  if (data.monteCarlo) {
    pages.push('monte_carlo')
  }

  // Page 6: Include if liquidity shortfall exists
  if (data.liquidity && data.liquidity.shortfall > 0) {
    pages.push('liquidity_analysis')
  }

  // Page 7: Always included if any action items
  if (data.actionItems.length > 0) {
    pages.push('action_items')
  }

  return pages
}

interface TaxCliff {
  year: number
  age: number
  totalTax: number
  gross: number
  netToHeirs: number
}

function detectTaxCliff(rows: PDFReportData['projectionChartRows']): TaxCliff | null {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].totalTax === 0 && rows[i].totalTax > 100_000) {
      return {
        year: rows[i].year,
        age: rows[i].age,
        totalTax: rows[i].totalTax,
        gross: rows[i].gross,
        netToHeirs: rows[i].netToHeirs,
      }
    }
  }
  if (rows.length > 0 && rows[0].totalTax > 100_000) {
    return {
      year: rows[0].year,
      age: rows[0].age,
      totalTax: rows[0].totalTax,
      gross: rows[0].gross,
      netToHeirs: rows[0].netToHeirs,
    }
  }
  return null
}

function buildEstateSVGChart(
  rows: PDFReportData['projectionChartRows'],
  _domicileState: string,
): string {
  if (rows.length === 0) return ''

  const W = 600
  const H = 180
  const PAD = { top: 10, right: 20, bottom: 28, left: 52 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const years = rows.map((r) => r.year)
  const grossArr = rows.map((r) => r.gross)
  const netArr = rows.map((r) => r.netToHeirs)
  const taxArr = rows.map((r) => r.totalTax)

  const minYear = years[0]
  const maxYear = years[years.length - 1]
  const maxVal = Math.max(...grossArr)

  const maxM = maxVal / 1_000_000
  const yStep = maxM <= 20 ? 5 : maxM <= 50 ? 10 : maxM <= 100 ? 20 : 25
  const yMax = Math.max(yStep, Math.ceil(maxM / yStep) * yStep)
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, i) => i * yStep)

  const yearSpan = maxYear - minYear
  const xTickEvery = yearSpan <= 20 ? 5 : yearSpan <= 30 ? 5 : 8
  const xTickYears = years.filter(
    (y, i) => i === 0 || i === years.length - 1 || (y - minYear) % xTickEvery === 0,
  )

  const xScale = (year: number): number =>
    PAD.left + (yearSpan === 0 ? innerW / 2 : ((year - minYear) / yearSpan) * innerW)

  const yScale = (val: number): number =>
    PAD.top + innerH - (yMax === 0 ? 0 : (val / 1_000_000 / yMax) * innerH)

  function polyline(vals: number[]): string {
    return vals.map((v, i) => `${xScale(years[i])},${yScale(v)}`).join(' ')
  }

  function areaPath(vals: number[], baseline: number): string {
    const firstX = xScale(years[0])
    const lastX = xScale(years[years.length - 1])
    const baseY = yScale(baseline)
    return (
      `M ${firstX},${baseY} ` +
      vals.map((v, i) => `L ${xScale(years[i])},${yScale(v)}`).join(' ') +
      ` L ${lastX},${baseY} Z`
    )
  }

  const hasAnyTax = taxArr.some((t) => t > 0)
  const cliffObj = detectTaxCliff(rows)

  const startGrossM = rows[0] ? Math.round((rows[0].gross / 1_000_000) * 10) / 10 : 0
  const endGrossM = Math.round((maxVal / 1_000_000) * 10) / 10

  const taxGapPath = hasAnyTax
    ? 'M ' +
      xScale(years[0]) +
      ',' +
      yScale(grossArr[0]) +
      ' ' +
      grossArr.map((v, i) => `L ${xScale(years[i])},${yScale(v)}`).join(' ') +
      ' ' +
      netArr
        .slice()
        .reverse()
        .map((v, i) => `L ${xScale(years[years.length - 1 - i])},${yScale(v)}`)
        .join(' ') +
      ' Z'
    : ''

  return `
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
     width="100%" style="display:block; max-height:${H}px;"
     role="img" aria-label="Line chart showing estate growth from $${startGrossM}M to $${endGrossM}M${cliffObj ? ', tax exposure begins at age ' + cliffObj.age : ''}">
  <title>Estate growth projection</title>
  <desc>Estate grows from $${startGrossM}M to $${endGrossM}M at longevity${cliffObj ? '. Tax exposure of $' + Math.round((cliffObj.totalTax / 1_000_000) * 10) / 10 + 'M begins at age ' + cliffObj.age + '.' : '. No estate tax exposure projected.'}</desc>

  ${yTicks
    .map((tick) => {
      const y = yScale(tick * 1_000_000)
      return `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}"
                  stroke="#e8e8e8" stroke-width="0.5"/>`
    })
    .join('\n  ')}

  ${hasAnyTax ? `<path d="${taxGapPath}" fill="rgba(226,75,74,0.12)" stroke="none"/>` : ''}

  <path d="${areaPath(grossArr, 0)}"
        fill="rgba(55,138,221,0.07)" stroke="none"/>

  <path d="${areaPath(netArr, 0)}"
        fill="rgba(99,153,34,0.07)" stroke="none"/>

  <polyline points="${polyline(grossArr)}"
            fill="none" stroke="#378ADD" stroke-width="1.8"/>

  <polyline points="${polyline(netArr)}"
            fill="none" stroke="#639922" stroke-width="1.8"
            stroke-dasharray="5,3"/>

  ${
    cliffObj
      ? `
  <line x1="${xScale(cliffObj.year)}" y1="${PAD.top}"
        x2="${xScale(cliffObj.year)}" y2="${H - PAD.bottom}"
        stroke="rgba(226,75,74,0.5)" stroke-width="1"
        stroke-dasharray="4,3"/>`
      : ''
  }

  ${yTicks
    .filter((_, i) => i % 2 === 0 || yTicks.length <= 5)
    .map((tick) => {
      const y = yScale(tick * 1_000_000)
      return `<text x="${PAD.left - 4}" y="${y + 3.5}"
                  text-anchor="end" font-size="8" fill="#888"
                  font-family="Arial, sans-serif">$${tick}M</text>`
    })
    .join('\n  ')}

  ${xTickYears
    .map((year) => {
      const x = xScale(year)
      return `<text x="${x}" y="${H - 4}"
                  text-anchor="middle" font-size="8" fill="#888"
                  font-family="Arial, sans-serif">${year}</text>`
    })
    .join('\n  ')}

  <line x1="${PAD.left}" y1="${PAD.top}"
        x2="${PAD.left}" y2="${H - PAD.bottom}"
        stroke="#ccc" stroke-width="0.5"/>
  <line x1="${PAD.left}" y1="${H - PAD.bottom}"
        x2="${W - PAD.right}" y2="${H - PAD.bottom}"
        stroke="#ccc" stroke-width="0.5"/>
</svg>`
}

function renderBeneficiarySummaryPage(
  data: PDFReportData,
  pages: string[],
  fmt: (n: number) => string,
): string {
  if (!pages.includes('beneficiary_summary') || !data.beneficiaryData) return ''

  const bd = data.beneficiaryData
  const pageNum = pages.indexOf('beneficiary_summary') + 1

  const retirementGroups = bd.groups.filter((g) =>
    ['retirement', '401k', 'ira', 'roth', '403b', '457', 'pension', 'traditional_401k', 'traditional_ira', 'rollover_ira'].includes(
      g.accountType.toLowerCase(),
    ),
  )
  const insuranceGroups = bd.groups.filter((g) => g.accountType.toLowerCase().includes('insurance'))
  const otherGroups = bd.groups.filter((g) => !retirementGroups.includes(g) && !insuranceGroups.includes(g))

  const badge = (status: string) => {
    if (status === 'complete') return `<span class="bene-badge bene-badge-ok">Complete</span>`
    if (status === 'missing_primary') return `<span class="bene-badge bene-badge-bad">Missing primary</span>`
    if (status === 'missing_contingent') return `<span class="bene-badge bene-badge-warn">Missing contingent</span>`
    return `<span class="bene-badge bene-badge-warn">Review needed</span>`
  }

  const renderGroup = (g: (typeof bd.groups)[number]) => `
    <div class="bene-group">
      <div class="bene-group-header">
        <div>
          <div class="bene-group-name">${g.accountName}</div>
          <div class="bene-group-meta">${g.accountType} · ${g.owner}${g.estimatedValue > 0 ? ` · Est. value ${fmt(g.estimatedValue)}` : ''}</div>
        </div>
        ${badge(g.status)}
      </div>
      ${
        g.status === 'missing_primary'
          ? `
        <div class="bene-missing">
          No primary beneficiary designated. This account will pass through probate.
        </div>
      `
          : ''
      }
      ${g.primaryBenes
        .map(
          (b) => `
        <div class="bene-row">
          <div class="bene-dot dot-p"></div>
          <div>
            <div style="font-weight:500;">${b.name}</div>
            <div style="font-size:9pt; color:#666;">${b.relationship}</div>
          </div>
          <div style="color:#555;">Primary</div>
          <div style="text-align:right; font-weight:500;">${Math.round(b.allocationPct)}%</div>
        </div>
      `,
        )
        .join('')}
      ${g.contingentBenes
        .map(
          (b) => `
        <div class="bene-row" style="background:#fafafa;">
          <div class="bene-dot dot-c"></div>
          <div>
            <div>${b.name}</div>
            <div style="font-size:9pt; color:#666;">${b.relationship}</div>
          </div>
          <div style="color:#888;">Contingent</div>
          <div style="text-align:right; color:#555;">${Math.round(b.allocationPct)}%</div>
        </div>
      `,
        )
        .join('')}
      ${
        g.status === 'missing_contingent'
          ? `
        <div class="bene-missing bene-missing-warn" style="border-top:0.5px solid #ffe0b2;">
          No contingent beneficiary. If the primary predeceases the owner, assets pass through probate.
        </div>
      `
          : ''
      }
    </div>
  `

  const renderSection = (label: string, groups: typeof bd.groups) => {
    if (groups.length === 0) return ''
    return `
      <div class="section-title" style="margin-top:14px;">${label}</div>
      ${groups.map(renderGroup).join('')}
    `
  }

  const gapGroups = bd.groups.filter((g) => g.status !== 'complete')
  const gapBoxHtml =
    gapGroups.length > 0
      ? `
    <div class="bene-gap-box">
      <div class="bene-gap-title">Action items — beneficiary gaps</div>
      ${gapGroups
        .map(
          (g) => `
        <div class="bene-gap-item">
          <span style="font-size:10pt; margin-top:1px;">•</span>
          <div>
            <strong>${g.accountName}:</strong>
            ${
              g.status === 'missing_primary'
                ? 'Add a primary beneficiary. Without one, this account passes through probate regardless of your will.'
                : 'Add a contingent beneficiary so assets don\'t pass through probate if the primary predeceases.'
            }
          </div>
        </div>
      `,
        )
        .join('')}
    </div>
  `
      : ''

  return `
    <div class="page">
      <div class="header">
        <div class="firm-name">${data.firmName} | ${data.clientName}</div>
        <div class="report-title" style="font-size:18pt;">Beneficiary summary</div>
      </div>

      <div class="metric-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:16px;">
        <div class="metric-card">
          <div class="metric-label">Accounts reviewed</div>
          <div class="metric-value">${bd.totalAccounts}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Fully designated</div>
          <div class="metric-value" style="color:${bd.completeCount === bd.totalAccounts ? '#166534' : '#1a1a2e'}">
            ${bd.completeCount}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Gaps identified</div>
          <div class="metric-value" style="color:${bd.missingPrimaryCount + bd.missingContingentCount > 0 ? '#c0392b' : '#166534'}">
            ${bd.missingPrimaryCount + bd.missingContingentCount}
          </div>
        </div>
      </div>

      <div style="display:flex; gap:16px; margin-bottom:12px; font-size:9pt; color:#555;">
        <span><span style="display:inline-block; width:8px; height:8px; border-radius:50%;
          background:#378ADD; margin-right:4px; vertical-align:middle;"></span>Primary beneficiary</span>
        <span><span style="display:inline-block; width:8px; height:8px; border-radius:50%;
          background:#b0b0b0; margin-right:4px; vertical-align:middle;"></span>Contingent beneficiary</span>
      </div>

      ${renderSection('Retirement accounts', retirementGroups)}
      ${renderSection('Life insurance', insuranceGroups)}
      ${renderSection('Other accounts', otherGroups)}

      ${gapBoxHtml}

      <div class="bene-no-data" style="margin-top:14px;">
        Beneficiary designations shown reflect data entered by the client or imported from connected accounts.
        Verify designations directly with each account custodian before relying on this summary.
        Accounts not listed above did not have beneficiary data available at time of report.
      </div>

      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page ${pageNum} of ${pages.length}</span>
      </div>
    </div>
  `
}

// HTML template for PDF generation via browser print
export function generatePDFHTML(data: PDFReportData): string {
  const executiveSummary = generateExecutiveSummary(data)
  const taxCallout = generateTaxCallout(data)
  const healthTrend = generateHealthTrend(data)
  const enrichedActions = dedupeActionItems(enrichActionItems(data.actionItems, data))
  const giftingSummary = generateGiftingSummary(data)
  const actionGroups = groupActionItems(enrichedActions)

  const stateName = getStateDisplayName(data.domicileState)
  const hasBypassTrust = Boolean(data.hasBypassTrust ?? data.hasIrrevocableTrust)
  const coverStateResult = calculateStateEstateTax(
    data.grossEstate,
    data.domicileState,
    data.stateBrackets ?? [],
    isMFJFilingStatus(data.filingStatus),
    hasBypassTrust,
  )
  const coverStateTax = resolveActiveStateTax(coverStateResult, hasBypassTrust)
  const stateTaxScenarios = calculateStateTaxScenarios({
    grossEstate: data.grossEstate,
    stateCode: data.domicileState,
    brackets: data.stateBrackets ?? [],
    filingStatus: data.filingStatus,
  })
  const page3StateTax = stateTaxScenarios.withoutBypassTrust.stateTax

  const pages = determinePDFPages(data)
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
      .page { width: 8.5in; min-height: 11in; padding: 1in; page-break-after: always; position: relative; }
      .page:last-child { page-break-after: avoid; }
      .header { border-bottom: 2px solid #2E4057; padding-bottom: 16px; margin-bottom: 24px; }
      .firm-name { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }
      .report-title { font-size: 22pt; font-weight: bold; color: #2E4057; margin: 8px 0 4px; }
      .client-name { font-size: 14pt; color: #444; }
      .section-title { font-size: 14pt; font-weight: bold; color: #2E4057; margin: 24px 0 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
      .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
      .metric-card { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; }
      .metric-label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
      .metric-value { font-size: 16pt; font-weight: bold; color: #2E4057; }
      .metric-sub { font-size: 8pt; color: #888; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th { background: #2E4057; color: white; padding: 8px 12px; text-align: left; font-size: 9pt; }
      td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 10pt; }
      tr:nth-child(even) td { background: #f8f9fa; }
      .alert-critical { border-left: 4px solid #dc2626; padding: 8px 12px; margin: 8px 0; background: #fef2f2; }
      .alert-warning { border-left: 4px solid #d97706; padding: 8px 12px; margin: 8px 0; background: #fffbeb; }
      .alert-info { border-left: 4px solid #2563eb; padding: 8px 12px; margin: 8px 0; background: #eff6ff; }
      .alert-title { font-weight: bold; font-size: 10pt; margin-bottom: 2px; }
      .alert-body { font-size: 9pt; color: #444; }
      .footer { position: absolute; bottom: 0.5in; left: 1in; right: 1in; font-size: 8pt; color: #999; border-top: 1px solid #e0e0e0; padding-top: 8px; }
      .disclaimer { font-size: 7.5pt; color: #888; margin-top: 16px; font-style: italic; line-height: 1.4; }
      .health-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin: 4px 0; }
      .health-fill { height: 100%; border-radius: 4px; }
      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      .exec-summary { background:#f0f4fa; border-left:4px solid #2E4057; padding:16px 20px; margin:20px 0 24px; border-radius:0 4px 4px 0; }
      .exec-summary p { font-size:11pt; line-height:1.7; color:#1a1a1a; }
      .metric-row { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin:20px 0; }
      .metric-card .label { font-size:9pt; color:#666; margin-bottom:4px; }
      .metric-card .value { font-size:18pt; font-weight:bold; color:#1a1a2e; }
      .metric-card .sub { font-size:9pt; color:#888; margin-top:2px; }
      .tax-callout { padding:14px 18px; border-radius:6px; margin:16px 0; font-size:10pt; }
      .tax-callout.clear { background:#e8f5e9; border:1px solid #66bb6a; }
      .tax-callout.sunset_risk { background:#fff8e1; border:1px solid #ffc107; }
      .tax-callout.exposed { background:#fce4ec; border:1px solid #e57373; }
      .tax-callout .tc-headline { font-weight:bold; font-size:11pt; margin-bottom:4px; }
      .tax-callout .tc-detail { color:#444; line-height:1.5; }
      .gifting-bar { background:#f0f0f0; border-radius:4px; padding:10px 16px; font-size:9.5pt; color:#444; margin-top:16px; }
      .chart-section { margin: 16px 0; }
      .chart-legend { display: flex; gap: 16px; margin-top: 6px; margin-bottom: 12px; font-size: 9pt; color: #555; }
      .chart-legend-item { display: flex; align-items: center; gap: 4px; }
      .chart-legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
      .tax-cliff-callout { background: #FEF9EC; border: 1px solid #EF9F27; border-radius: 5px;
                           padding: 10px 14px; margin: 10px 0 14px; font-size: 9.5pt; color: #633806; }
      .tax-cliff-callout strong { color: #412402; }
      .snapshot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
      .asset-bar-wrap { height: 3px; background: #e8e8e8; border-radius: 2px; margin-top: 3px; }
      .asset-bar-fill { height: 3px; border-radius: 2px; background: #378ADD; }
      .bene-group { border: 1px solid #e0e0e0; border-radius: 6px;
                    margin-bottom: 10px; overflow: hidden; page-break-inside: avoid; }
      .bene-group-header { display: flex; justify-content: space-between; align-items: center;
                           padding: 8px 12px; background: #f8f8f8;
                           border-bottom: 1px solid #e0e0e0; }
      .bene-group-name { font-size: 11pt; font-weight: bold; color: #1a1a2e; }
      .bene-group-meta { font-size: 9pt; color: #666; margin-top: 2px; }
      .bene-badge { font-size: 9pt; font-weight: bold; padding: 2px 8px;
                    border-radius: 20px; white-space: nowrap; }
      .bene-badge-ok   { background: #e8f5e9; color: #1b5e20; }
      .bene-badge-warn { background: #fff8e1; color: #e65100; }
      .bene-badge-bad  { background: #fce4ec; color: #880e4f; }
      .bene-row { display: grid; grid-template-columns: 12px 1fr 100px 50px;
                  gap: 8px; padding: 6px 12px; border-bottom: 0.5px solid #f0f0f0;
                  align-items: center; font-size: 10pt; }
      .bene-row:last-child { border-bottom: none; }
      .bene-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .dot-p { background: #378ADD; }
      .dot-c { background: #b0b0b0; }
      .bene-missing { padding: 8px 12px; font-size: 9.5pt; font-style: italic; color: #c0392b; }
      .bene-missing-warn { color: #e65100; }
      .bene-gap-box { background: #fce4ec; border: 1px solid #e57373; border-radius: 5px;
                      padding: 10px 14px; margin-top: 14px; font-size: 9.5pt; color: #4a0000; }
      .bene-gap-title { font-weight: bold; font-size: 10.5pt; margin-bottom: 6px; color: #7b0000; }
      .bene-gap-item { padding: 3px 0; border-bottom: 0.5px solid rgba(229,57,53,0.2);
                       display: flex; gap: 6px; line-height: 1.4; }
      .bene-gap-item:last-child { border-bottom: none; }
      .bene-no-data { background: #f5f5f5; border-radius: 5px; padding: 10px 14px;
                      font-size: 9.5pt; color: #555; margin-top: 10px; }
      @media print { .page { page-break-after: always; } }
    </style>
  `

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Estate Planning Report — ${data.clientName}</title>${styles}</head><body>`

  // PAGE 1: Cover
  if (pages.includes('cover')) {
    html += `
    <div class="page">
      <div class="header">
        <div class="firm-name">${data.firmName}</div>
        <div class="report-title">Estate Planning Report</div>
        <div class="client-name">${data.clientName}</div>
        ${data.advisorPhone ? `<div style="font-size:9pt;color:#666;margin-top:4px;">${data.advisorPhone}</div>` : ''}
        ${data.advisorEmail ? `<div style="font-size:9pt;color:#666;">${data.advisorEmail}</div>` : ''}
        ${data.meetingDate ? `
        <div style="font-size:10pt; color:#666; margin-top:8px;">
          Prepared for meeting of ${new Date(data.meetingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        ` : `
        <div style="font-size:10pt; color:#666; margin-top:8px;">
          Prepared ${data.reportDate}
        </div>
        `}
      </div>
      <div class="exec-summary">
        <p>${executiveSummary}</p>
      </div>
      <div class="metric-row">
        <div class="metric-card">
          <div class="label">Gross estate</div>
          <div class="value">${fmt(data.grossEstate)}</div>
          <div class="sub">Current value</div>
        </div>
        <div class="metric-card">
          <div class="label">Est. total tax exposure</div>
          <div class="value">${fmt((data.federalTax ?? 0) + coverStateTax)}</div>
          <div class="sub">Federal + ${stateName} state</div>
        </div>
        <div class="metric-card">
          <div class="label">Plan health score</div>
          <div class="value">${healthTrend.label}</div>
          <div class="sub">${healthTrend.interpretation}</div>
        </div>
      </div>
      <div class="tax-callout ${taxCallout.style}">
        <div class="tc-headline">${taxCallout.headline}</div>
        <div class="tc-detail">${taxCallout.detail}</div>
      </div>
      ${giftingSummary.show ? `
      <div class="gifting-bar">
        <strong>Gifting capacity:</strong> ${giftingSummary.headline}
      </div>
      ` : ''}
      <div class="disclaimer">
        This report is for informational purposes only and does not constitute legal, tax, or financial advice.
        Estate planning involves complex legal and tax considerations. Please consult with a qualified attorney
        and tax advisor before implementing any estate planning strategy. Projections are based on current law
        and assumptions that may change. Past performance is not indicative of future results.
      </div>
      <div class="footer">
        <span>${data.firmName} | ${data.advisorName} | ${data.reportDate}</span>
        <span style="float:right">Page 1 of ${pages.length}</span>
      </div>
    </div>`
  }

  // PAGE 2: Estate Snapshot
  if (pages.includes('estate_snapshot')) {
    const cliff = detectTaxCliff(data.projectionChartRows)
    const hasAnyTax = data.projectionChartRows.some((r) => r.totalTax > 0)

    html += `
    <div class="page">
      <div class="header">
        <div class="firm-name">${data.firmName} | ${data.clientName}</div>
        <div class="report-title" style="font-size:18pt">Estate Snapshot</div>
      </div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Gross Estate</div>
          <div class="metric-value">${fmt(data.grossEstate)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Net Worth</div>
          <div class="metric-value">${fmt(data.netWorth)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Liquid Assets</div>
          <div class="metric-value">${fmt(data.liquidAssets)}</div>
          <div class="metric-sub">${data.grossEstate > 0 ? pct(data.liquidAssets / data.grossEstate) : '0%'} of estate</div>
        </div>
      </div>
      ${
        data.projectionChartRows.length === 0
          ? `
      <div style="background:#f8f8f8; border-radius:5px; padding:16px;
                  text-align:center; font-size:9.5pt; color:#888; margin:16px 0;">
        Run the base case to see the estate growth projection chart.
      </div>
      `
          : `
      <div class="section-title">Estate growth projection</div>
      <div class="chart-section">
        <div style="margin: 4px 0 4px;">
          ${buildEstateSVGChart(data.projectionChartRows, data.domicileState)}
        </div>
        <div class="chart-legend">
          <div class="chart-legend-item">
            <div class="chart-legend-dot" style="background:#378ADD"></div>
            Gross estate
          </div>
          <div class="chart-legend-item">
            <div class="chart-legend-dot" style="background:#639922"></div>
            Net to heirs
          </div>
          ${
            hasAnyTax
              ? `
          <div class="chart-legend-item">
            <div class="chart-legend-dot" style="background:#E24B4A"></div>
            Est. tax exposure
          </div>`
              : ''
          }
        </div>
      </div>
      ${
        cliff
          ? `
      <div class="tax-cliff-callout">
        <strong>Tax exposure begins at age ${cliff.age} (${cliff.year}):</strong>
        Combined federal and ${stateName} state estate tax estimated at
        ${fmt(cliff.totalTax)}, reducing net to heirs to ${fmt(cliff.netToHeirs)}.
        A bypass trust and gifting program can meaningfully reduce this exposure
        before this point.
      </div>
      `
          : `
      <div style="background:#EAF3DE; border:1px solid #97C459; border-radius:5px;
                  padding:10px 14px; margin:10px 0 14px; font-size:9.5pt; color:#27500A;">
        No estate tax exposure is projected under current law.
        Monitor as estate grows or tax law changes.
      </div>
      `
      }
      `
      }
      <div class="snapshot-grid">
        <div>
          <div class="section-title">Asset breakdown</div>
          <table style="width:100%; border-collapse:collapse; font-size:9.5pt;">
            <tr style="border-bottom:1px solid #ddd;">
              <th style="text-align:left; padding:4px 0; font-size:8.5pt; color:#666;
                         font-weight:500; text-transform:uppercase; letter-spacing:0.05em;">Category</th>
              <th style="text-align:right; padding:4px 0; font-size:8.5pt; color:#666;
                         font-weight:500; text-transform:uppercase; letter-spacing:0.05em;">Value</th>
              <th style="text-align:right; padding:4px 0; font-size:8.5pt; color:#666;
                         font-weight:500; text-transform:uppercase; letter-spacing:0.05em;">%</th>
            </tr>
            ${
              data.assetBreakdown.length > 0
                ? data.assetBreakdown
                    .map(
                      (a) => `
            <tr style="border-bottom:0.5px solid #eee;">
              <td style="padding:5px 0; color:#333;">
                ${a.label}
                <div class="asset-bar-wrap">
                  <div class="asset-bar-fill" style="width:${Math.round(a.pct * 100)}%"></div>
                </div>
              </td>
              <td style="padding:5px 0; text-align:right; color:#333;">${fmt(a.value)}</td>
              <td style="padding:5px 0; text-align:right; color:#666;">${Math.round(a.pct * 100)}%</td>
            </tr>
          `,
                    )
                    .join('')
                : `<tr><td colspan="3" style="padding:8px 0;color:#666;font-style:italic;">No asset category data available — add assets in the client profile.</td></tr>`
            }
          </table>
        </div>
        <div>
          <div class="section-title">Estate readiness — ${data.healthScore}/100</div>
          ${
            data.healthComponents.length > 0
              ? data.healthComponents
                  .map((c) => {
                    const barPct = c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0
                    const color = barPct >= 70 ? '#639922' : barPct >= 40 ? '#EF9F27' : '#E24B4A'
                    return `
          <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:9pt;
                        color:#444; margin-bottom:3px;">
              <span>${c.label}</span>
              <span style="color:${color}; font-weight:500;">${c.score}/${c.maxScore}</span>
            </div>
            <div style="height:4px; background:#e8e8e8; border-radius:2px;">
              <div style="height:4px; border-radius:2px; width:${barPct}%;
                          background:${color};"></div>
            </div>
          </div>
        `
                  })
                  .join('')
              : `<p style="font-size:9pt;color:#666;font-style:italic;">Health score components not yet calculated for this household.</p>`
          }
        </div>
      </div>
      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page 2 of ${pages.length}</span>
      </div>
    </div>`
  }

  html += renderBeneficiarySummaryPage(data, pages, fmt)

  // Tax Analysis
  if (pages.includes('tax_analysis')) {
    const taxAnalysisSection = stateTaxScenarios.showScenarioTable
      ? `
      <div class="section-title">${stateName} estate tax — planning scenario comparison</div>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:10pt;">
        <tr style="background:#2E4057;color:#fff;">
          <th style="padding:8px 10px;text-align:left;">Scenario</th>
          <th style="padding:8px 10px;text-align:right;">State tax</th>
          <th style="padding:8px 10px;text-align:right;">Net to heirs</th>
        </tr>
        <tr style="background:#f0f7f0;">
          <td style="padding:8px 10px;">
            <strong>With bypass trust</strong><br>
            <span style="font-size:9pt;color:#555;">Both spouses' exemptions preserved</span>
          </td>
          <td style="padding:8px 10px;text-align:right;color:#166534;font-weight:bold;">
            ${fmt(stateTaxScenarios.withBypassTrust.stateTax)}
          </td>
          <td style="padding:8px 10px;text-align:right;">
            ${fmt(data.grossEstate - stateTaxScenarios.withBypassTrust.stateTax)}
          </td>
        </tr>
        <tr style="background:#fef2f2;">
          <td style="padding:8px 10px;">
            <strong>Without bypass trust (current situation)</strong><br>
            <span style="font-size:9pt;color:#555;">First spouse's exemption permanently lost at death</span>
          </td>
          <td style="padding:8px 10px;text-align:right;color:#991b1b;font-weight:bold;">
            ${fmt(stateTaxScenarios.withoutBypassTrust.stateTax)}
          </td>
          <td style="padding:8px 10px;text-align:right;">
            ${fmt(data.grossEstate - stateTaxScenarios.withoutBypassTrust.stateTax)}
          </td>
        </tr>
        <tr style="background:#fffbeb;border-top:2px solid #d97706;">
          <td style="padding:8px 10px;"><strong>Bypass trust planning benefit</strong></td>
          <td style="padding:8px 10px;text-align:right;color:#92400e;font-weight:bold;">
            ${fmt(stateTaxScenarios.planningGap)} saved
          </td>
          <td style="padding:8px 10px;text-align:right;color:#92400e;">
            ${fmt(stateTaxScenarios.planningGap)} more to heirs
          </td>
        </tr>
      </table>
      <div style="background:#fff8e1;border:1px solid #fbbf24;border-radius:5px;padding:10px 14px;font-size:9.5pt;color:#451a03;margin-bottom:12px;">
        ${STATE_PORTABILITY_NOTES[data.domicileState] ?? ''}
      </div>`
      : `
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Federal estate tax</div>
          <div class="metric-value">${fmt(data.federalTax ?? 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">${stateName} estate tax</div>
          <div class="metric-value">${fmt(page3StateTax)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Net to heirs</div>
          <div class="metric-value">${fmt(data.grossEstate - (data.federalTax ?? 0) - page3StateTax)}</div>
        </div>
      </div>`

    html += `
    <div class="page">
      <div class="header">
        <div class="firm-name">${data.firmName} | ${data.clientName}</div>
        <div class="report-title" style="font-size:18pt">Federal & State Tax Analysis</div>
      </div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Federal Exemption</div>
          <div class="metric-value">${fmt(data.federalExemption)}</div>
          <div class="metric-sub">${data.lawScenario.replace(/_/g, ' ')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Federal Estate Tax</div>
          <div class="metric-value" style="color:${data.federalTax > 0 ? '#dc2626' : '#16a34a'}">${fmt(data.federalTax)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">State Estate Tax</div>
          <div class="metric-value" style="color:${page3StateTax > 0 ? '#dc2626' : '#16a34a'}">${fmt(page3StateTax)}</div>
        </div>
      </div>
      ${taxAnalysisSection}
      <div class="disclaimer" style="margin-top:32px">
        Tax calculations are estimates based on current federal and state law. Actual tax liability
        depends on many factors including asset valuations at death, applicable deductions, and
        future changes in tax law. Consult a qualified tax attorney for precise calculations.
      </div>
      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page 3 of ${pages.length}</span>
      </div>
    </div>`
  }

  // PAGE 4: Strategy Summary (conditional)
  if (pages.includes('strategy_summary')) {
    const totalReduction = data.activeStrategies.reduce((s, a) => s + a.estateReduction, 0)
    const totalSavings = data.activeStrategies.reduce((s, a) => s + a.taxSavings, 0)
    // Same deduped/enriched alerts as action-items page — raw household_alerts can duplicate trust rows (HIGH + MEDIUM)
    const strategyGapRecommendations = enrichedActions.filter((a) =>
      ['trust', 'gift', 'ilit', 'cst'].some((k) =>
        (a.title ?? a.body ?? a.message ?? '').toLowerCase().includes(k),
      ),
    )
    const strategyBody = data.activeStrategies.length === 0 ? `
      <div style="background:#f8f8f8; border-radius:6px; padding:16px; font-size:10pt; color:#666;">
        <strong>No active strategies on file.</strong><br>
        Strategies discussed in this meeting will be added here after advisor review.
        ${strategyGapRecommendations.length > 0 ? `
        <br><br><strong>Strategies worth discussing based on your plan gaps:</strong>
        <ul style="margin-top:8px; padding-left:20px;">
          ${strategyGapRecommendations
            .slice(0, 3)
            .map((a) => `<li style="margin:4px 0">${a.title ?? a.body ?? a.message}</li>`)
            .join('')}
        </ul>` : ''}
      </div>
    ` : `
      <table>
        <tr><th>Strategy</th><th>Estate Reduction</th><th>Tax Savings</th><th>Notes</th></tr>
        ${data.activeStrategies.map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${fmt(s.estateReduction)}</td>
            <td>${fmt(s.taxSavings)}</td>
            <td style="font-size:9pt;color:#555">${s.notes}</td>
          </tr>
        `).join('')}
      </table>
    `
    html += `
    <div class="page">
      <div class="header">
        <div class="firm-name">${data.firmName} | ${data.clientName}</div>
        <div class="report-title" style="font-size:18pt">Strategy Summary</div>
      </div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Active Strategies</div>
          <div class="metric-value">${data.activeStrategies.length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Estate Reduction</div>
          <div class="metric-value" style="color:#16a34a">${fmt(totalReduction)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Projected Tax Savings</div>
          <div class="metric-value" style="color:#16a34a">${fmt(totalSavings)}</div>
        </div>
      </div>
      <div class="section-title">Active Strategy Detail</div>
      ${strategyBody}
      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page 4 of ${pages.length}</span>
      </div>
    </div>`
  }

  // PAGE 5: Monte Carlo (conditional)
  if (pages.includes('monte_carlo') && data.monteCarlo) {
    const mc = data.monteCarlo
    html += `
    <div class="page">
      <div class="header">
        <div class="firm-name">${data.firmName} | ${data.clientName}</div>
        <div class="report-title" style="font-size:18pt">Monte Carlo Analysis</div>
      </div>
      <p style="font-size:10pt;color:#444;margin-bottom:16px">
        Probabilistic analysis of estate tax outcomes across 500 market scenarios.
        Analysis run: ${mc.runDate}.
      </p>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Tax-Free Rate</div>
          <div class="metric-value" style="color:${mc.successRate > 50 ? '#16a34a' : '#dc2626'}">${mc.successRate}%</div>
          <div class="metric-sub">Scenarios with no estate tax</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Median Estate Tax</div>
          <div class="metric-value" style="color:#dc2626">${fmt(mc.p50Tax)}</div>
          <div class="metric-sub">P50 outcome</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Median Net to Heirs</div>
          <div class="metric-value" style="color:#2563eb">${fmt(mc.medianNetToHeirs)}</div>
          <div class="metric-sub">P50 outcome</div>
        </div>
      </div>
      <div class="section-title">Outcome Range</div>
      <table>
        <tr><th>Scenario</th><th>Estate Tax</th><th>Net to Heirs</th></tr>
        <tr><td>Bear Market (P10)</td><td>${fmt(mc.p10Tax)}</td><td>—</td></tr>
        <tr><td>Median (P50)</td><td>${fmt(mc.p50Tax)}</td><td>${fmt(mc.medianNetToHeirs)}</td></tr>
        <tr><td>Bull Market (P90)</td><td>${fmt(mc.p90Tax)}</td><td>—</td></tr>
      </table>
      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page 5 of ${pages.length}</span>
      </div>
    </div>`
  }

  // PAGE 6: Liquidity Analysis (conditional)
  if (pages.includes('liquidity_analysis') && data.liquidity) {
    const liq = data.liquidity
    html += `
    <div class="page">
      <div class="header">
        <div class="firm-name">${data.firmName} | ${data.clientName}</div>
        <div class="report-title" style="font-size:18pt">Liquidity Analysis</div>
      </div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Coverage Ratio</div>
          <div class="metric-value" style="color:${liq.coverageRatio >= 1 ? '#16a34a' : '#dc2626'}">${liq.coverageRatio.toFixed(2)}x</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Liquidity Shortfall</div>
          <div class="metric-value" style="color:#dc2626">${fmt(liq.shortfall)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Recommended ILIT Coverage</div>
          <div class="metric-value">${fmt(liq.recommendedILIT)}</div>
        </div>
      </div>
      <div class="alert-critical" style="margin-top:24px">
        <div class="alert-title">Liquidity Shortfall Detected</div>
        <div class="alert-body">
          Available liquid assets are insufficient to cover the estimated estate tax burden
          without a forced sale of illiquid assets. An ILIT with a death benefit of at least
          ${fmt(liq.recommendedILIT)} is recommended to cover this gap.
        </div>
      </div>
      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page 6 of ${pages.length}</span>
      </div>
    </div>`
  }

  // PAGE 7: Action Items (conditional)
  if (pages.includes('action_items')) {
    html += `
    <div class="page">
      <div class="header">
        <div class="firm-name">${data.firmName} | ${data.clientName}</div>
        <div class="report-title" style="font-size:18pt">Action Items & Recommendations</div>
      </div>
      ${actionGroups
        .map(
          (group) => `
      <div style="margin-bottom:20px;">
        <div style="font-size:10pt; font-weight:bold; color:#2E4057; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:10px;">
          ${group.label}
        </div>
        ${group.items
          .map(
            (item) => `
        <div class="alert-${item.severity === 'high' || item.severity === 'critical' ? 'critical' : item.severity === 'medium' || item.severity === 'warning' ? 'warning' : 'info'}"
             style="margin-bottom:10px; padding:12px 14px; border-radius:5px;">
          <div class="alert-title" style="font-weight:bold; margin-bottom:4px;">
            ${item.title ?? item.body ?? item.message}
          </div>
          <div class="alert-body" style="font-size:10pt; margin-bottom:6px;">
            ${item.body ?? item.message}
          </div>
          ${
            item.dollarImpact
              ? `
          <div style="font-size:9.5pt; color:#555; margin-top:4px;">
            <strong>Impact:</strong> ${item.dollarImpact}
          </div>`
              : ''
          }
          ${
            item.nextStep
              ? `
          <div style="font-size:9.5pt; color:#555; margin-top:3px;">
            <strong>Next step (${item.owner ?? 'advisor'}):</strong> ${item.nextStep}
          </div>`
              : ''
          }
        </div>`,
          )
          .join('')}
      </div>`,
        )
        .join('')}
      <div class="disclaimer" style="margin-top:32px">
        This report is for informational purposes only and does not constitute legal, tax, or financial advice.
        MyWealthMaps / Estate Planner is not a law firm and does not provide legal services.
        All estate planning strategies should be reviewed by a qualified estate planning attorney
        and tax professional before implementation.
      </div>
      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page ${pages.length} of ${pages.length}</span>
      </div>
    </div>`
  }

  html += '</body></html>'
  return html
}
