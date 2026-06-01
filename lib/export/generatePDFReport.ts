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

  // Page 3: Always included
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
      <div class="section-title">Asset Breakdown</div>
      <table>
        <tr><th>Asset Category</th><th>Value</th><th>% of Estate</th></tr>
        ${data.assetBreakdown.length > 0
          ? data.assetBreakdown.map(a => `<tr><td>${a.label}</td><td>${fmt(a.value)}</td><td>${pct(a.pct)}</td></tr>`).join('')
          : `<tr><td colspan="3" style="color:#666;font-style:italic;">No asset category data available — add assets in the client profile.</td></tr>`}
      </table>
      <div class="section-title">Plan Health Score Components</div>
      ${data.healthComponents.length > 0
        ? data.healthComponents.map(c => `
        <div style="margin: 8px 0;">
          <div style="display:flex; justify-content:space-between; font-size:10pt; margin-bottom:3px;">
            <span>${c.label}</span>
            <span>${c.score}/${c.maxScore}</span>
          </div>
          <div class="health-bar">
            <div class="health-fill" style="width:${c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0}%; background:${c.maxScore > 0 && c.score / c.maxScore > 0.7 ? '#16a34a' : c.maxScore > 0 && c.score / c.maxScore > 0.4 ? '#d97706' : '#dc2626'};"></div>
          </div>
        </div>
      `).join('')
        : `<p style="font-size:10pt;color:#666;font-style:italic;">Health score components not yet calculated for this household.</p>`}
      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page 2 of ${pages.length}</span>
      </div>
    </div>`
  }

  // PAGE 3: Tax Analysis
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
    const strategyBody = data.activeStrategies.length === 0 ? `
      <div style="background:#f8f8f8; border-radius:6px; padding:16px; font-size:10pt; color:#666;">
        <strong>No active strategies on file.</strong><br>
        Strategies discussed in this meeting will be added here after advisor review.
        ${data.actionItems.some(a => (a.body ?? a.message ?? '').toLowerCase().includes('trust') ||
                                      (a.body ?? a.message ?? '').toLowerCase().includes('gift')) ? `
        <br><br><strong>Strategies worth discussing based on your plan gaps:</strong>
        <ul style="margin-top:8px; padding-left:20px;">
          ${data.actionItems
            .filter(a => ['trust','gift','ilit','cst'].some(k =>
              (a.title ?? a.body ?? a.message ?? '').toLowerCase().includes(k)))
            .slice(0, 3)
            .map(a => `<li style="margin:4px 0">${a.title ?? a.body ?? a.message}</li>`)
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
