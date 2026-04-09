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

export interface PDFReportData {
  // Household
  householdId: string
  clientName: string
  person1Name: string
  person2Name?: string
  advisorName: string
  firmName: string
  reportDate: string

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
  sunsetTax?: number

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
  actionItems: Array<{
    severity: string
    title: string
    body: string
  }>
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

  // Page 4: Include if any active strategies
  if (data.activeStrategies.length > 0) {
    pages.push('strategy_summary')
  }

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
      </div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Gross Estate</div>
          <div class="metric-value">${fmt(data.grossEstate)}</div>
          <div class="metric-sub">Current estimated value</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Plan Health Score</div>
          <div class="metric-value">${data.healthScore}/100</div>
          <div class="metric-sub">${data.healthScore >= 75 ? 'Good' : data.healthScore >= 50 ? 'Fair' : 'Needs Attention'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Est. Estate Tax</div>
          <div class="metric-value">${fmt(data.federalTax + data.stateTax)}</div>
          <div class="metric-sub">${data.lawScenario.replace('_', ' ')}</div>
        </div>
      </div>
      <p style="margin-top: 24px; color: #444; font-size: 10pt; line-height: 1.6;">
        This report was prepared by ${data.advisorName} of ${data.firmName} on ${data.reportDate}
        for ${data.clientName}. It summarizes the current state of your estate plan,
        projected tax exposure, and recommended strategies.
      </p>
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
        ${data.assetBreakdown.map(a => `<tr><td>${a.label}</td><td>${fmt(a.value)}</td><td>${pct(a.pct)}</td></tr>`).join('')}
      </table>
      <div class="section-title">Plan Health Score Components</div>
      ${data.healthComponents.map(c => `
        <div style="margin: 8px 0;">
          <div style="display:flex; justify-content:space-between; font-size:10pt; margin-bottom:3px;">
            <span>${c.label}</span>
            <span>${c.score}/${c.maxScore}</span>
          </div>
          <div class="health-bar">
            <div class="health-fill" style="width:${(c.score/c.maxScore)*100}%; background:${c.score/c.maxScore > 0.7 ? '#16a34a' : c.score/c.maxScore > 0.4 ? '#d97706' : '#dc2626'};"></div>
          </div>
        </div>
      `).join('')}
      <div class="footer">
        <span>${data.firmName} | ${data.clientName} | ${data.reportDate}</span>
        <span style="float:right">Page 2 of ${pages.length}</span>
      </div>
    </div>`
  }

  // PAGE 3: Tax Analysis
  if (pages.includes('tax_analysis')) {
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
          <div class="metric-value" style="color:${data.stateTax > 0 ? '#dc2626' : '#16a34a'}">${fmt(data.stateTax)}</div>
        </div>
      </div>
      <div class="section-title">Tax Scenario Comparison</div>
      <table>
        <tr><th>Scenario</th><th>Exemption</th><th>Est. Tax</th><th>Net to Heirs</th></tr>
        <tr>
          <td>Current Law</td>
          <td>${fmt(data.federalExemption)}</td>
          <td>${fmt(data.federalTax + data.stateTax)}</td>
          <td>${fmt(data.grossEstate - data.federalTax - data.stateTax)}</td>
        </tr>
        ${data.sunsetTax !== undefined ? `
        <tr>
          <td>Post-Sunset</td>
          <td>${fmt(7_000_000)}</td>
          <td>${fmt(data.sunsetTax)}</td>
          <td>${fmt(data.grossEstate - data.sunsetTax)}</td>
        </tr>` : ''}
        <tr>
          <td>No Exemption</td>
          <td>$0</td>
          <td>${fmt(data.grossEstate * 0.40)}</td>
          <td>${fmt(data.grossEstate * 0.60)}</td>
        </tr>
      </table>
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
      ${data.actionItems.map(item => `
        <div class="alert-${item.severity === 'critical' || item.severity === 'high' ? 'critical' : item.severity === 'warning' || item.severity === 'medium' ? 'warning' : 'info'}">
          <div class="alert-title">${item.title}</div>
          <div class="alert-body">${item.body}</div>
        </div>
      `).join('')}
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
