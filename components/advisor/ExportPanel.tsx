'use client'

import { useState } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import type {
  ActionItem,
  MonteCarloSummary,
  ScenarioVersion,
} from '@/lib/export-wiring'

export interface ExportProjectionRow {
  year: number
  age_p1: number
  age_p2: number | null
  gross_estate: number
  federal_tax: number
  state_tax: number
  net_to_heirs: number
}

export interface TaxSummaryExport {
  federal_tax_current: number
  state_tax: number
  state_name: string
}

interface ExportPanelProps {
  householdId: string
  scenarioId: string
  advisorName: string
  healthScore: number | null
  liquidAssets: number
  activeStrategies: string[]
  actionItems: ActionItem[]
  projectionData: ExportProjectionRow[]
  taxSummary: TaxSummaryExport | null
  monteCarloRun: boolean
  monteCarloResults: MonteCarloSummary | null
  liquidityShortfall: boolean
  scenarioHistory: ScenarioVersion[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function ExportPanel({
  householdId,
  scenarioId,
  advisorName,
  healthScore,
  liquidAssets,
  activeStrategies,
  actionItems,
  projectionData,
  taxSummary,
  monteCarloRun,
  monteCarloResults,
  liquidityShortfall,
  scenarioHistory,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState(false)

  const handlePdfExport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const pages: string[] = []

    pages.push(`
      <div class="page">
        <h1>Estate Planning Report</h1>
        <p class="subtitle">Prepared by ${advisorName || 'Your Advisor'}</p>
        <p class="date">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${healthScore !== null ? `<div class="score-box"><span class="score-label">Plan Health Score</span><span class="score-value">${healthScore}/100</span></div>` : ''}
        <p class="disclaimer">This report is for informational purposes only and does not constitute legal, tax, or financial advice. Projections are estimates based on current law and assumptions that may change.</p>
      </div>
    `)

    if (projectionData.length > 0) {
      pages.push(`
        <div class="page">
          <h2>Estate Snapshot</h2>
          <table>
            <thead><tr><th>Year</th><th>Age (P1)</th><th>Gross Estate</th><th>Federal Tax</th><th>State Tax</th><th>Net to Heirs</th></tr></thead>
            <tbody>
              ${projectionData
                .map(
                  (r) => `
                <tr>
                  <td>${r.year}</td>
                  <td>${r.age_p1}</td>
                  <td>${fmt(r.gross_estate)}</td>
                  <td>${fmt(r.federal_tax)}</td>
                  <td>${fmt(r.state_tax)}</td>
                  <td>${fmt(r.net_to_heirs)}</td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `)
    }

    if (taxSummary) {
      pages.push(`
        <div class="page">
          <h2>Tax Analysis</h2>
          <div class="metric-grid">
            <div class="metric"><span class="label">Federal Tax - Current Law</span><span class="value">${fmt(taxSummary.federal_tax_current)}</span></div>
            <div class="metric"><span class="label">${taxSummary.state_name} State Tax</span><span class="value">${fmt(taxSummary.state_tax)}</span></div>
          </div>
        </div>
      `)
    }

    if (activeStrategies.length > 0) {
      pages.push(`
        <div class="page">
          <h2>Strategy Summary</h2>
          <ul>
            ${activeStrategies.map((s) => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      `)
    }

    if (monteCarloRun && monteCarloResults) {
      pages.push(`
        <div class="page">
          <h2>Monte Carlo Analysis (${monteCarloResults.paths.toLocaleString()} paths)</h2>
          <div class="metric-grid">
            <div class="metric"><span class="label">P10 (Pessimistic)</span><span class="value">${fmt(monteCarloResults.p10)}</span></div>
            <div class="metric"><span class="label">P50 (Base Case)</span><span class="value">${fmt(monteCarloResults.p50)}</span></div>
            <div class="metric"><span class="label">P90 (Optimistic)</span><span class="value">${fmt(monteCarloResults.p90)}</span></div>
          </div>
        </div>
      `)
    }

    if (liquidityShortfall) {
      pages.push(`
        <div class="page">
          <h2>Liquidity Analysis</h2>
          <p class="alert-box">Liquidity shortfall identified. Liquid assets (${fmt(liquidAssets)}) may be insufficient to cover projected estate taxes without forced asset sales.</p>
        </div>
      `)
    }

    if (actionItems.length > 0) {
      pages.push(`
        <div class="page">
          <h2>Action Items</h2>
          <ul class="action-list">
            ${actionItems
              .map(
                (a) => `
              <li class="action-${a.severity}">
                <span class="badge">${a.severity.toUpperCase()}</span>
                ${a.message}
              </li>`,
              )
              .join('')}
          </ul>
        </div>
      `)
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Estate Planning Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; }
          .page { page-break-after: always; padding: 60px; min-height: 100vh; box-sizing: border-box; }
          h1 { font-size: 32px; color: #1a1a2e; margin-bottom: 8px; }
          h2 { font-size: 24px; color: #1a1a2e; border-bottom: 2px solid #d4af37; padding-bottom: 8px; }
          .subtitle { font-size: 18px; color: #555; margin: 4px 0; }
          .date { font-size: 14px; color: #888; }
          .score-box { display: flex; gap: 16px; align-items: center; margin: 32px 0; background: #f8f4e8; padding: 24px; border-radius: 8px; }
          .score-label { font-size: 18px; font-weight: bold; }
          .score-value { font-size: 48px; font-weight: bold; color: #d4af37; }
          .disclaimer { font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 16px; margin-top: 32px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #1a1a2e; color: white; padding: 10px; text-align: left; font-size: 12px; }
          td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 24px; }
          .metric { background: #f8f4e8; padding: 20px; border-radius: 8px; }
          .metric .label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; }
          .metric .value { display: block; font-size: 24px; font-weight: bold; color: #1a1a2e; }
          .alert-box { background: #fff3cd; border: 1px solid #ffc107; padding: 16px; border-radius: 8px; }
          .action-list { list-style: none; padding: 0; }
          .action-list li { padding: 12px 16px; border-radius: 6px; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 12px; background: #f9f9f9; }
          .badge { font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 10px; background: #eee; white-space: nowrap; }
          .action-critical .badge { background: #fee2e2; color: #dc2626; }
          .action-warning .badge { background: #fef3c7; color: #d97706; }
          .action-high .badge { background: #fef3c7; color: #d97706; }
          .action-medium .badge { background: #fef3c7; color: #d97706; }
          .action-low .badge { background: #dbeafe; color: #2563eb; }
          .action-info .badge { background: #dbeafe; color: #2563eb; }
          @media print { .page { page-break-after: always; } }
        </style>
      </head>
      <body>${pages.join('')}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExcelExport = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')

      const wb = XLSX.utils.book_new()

      const assumptions = [
        ['EstatePlanner - Export'],
        ['Generated', new Date().toISOString()],
        ['Advisor', advisorName || ''],
        ['Scenario ID', scenarioId],
        ['Household ID', householdId],
        ['Health Score', healthScore ?? ''],
        ['Liquid Assets', liquidAssets],
        ['Active Strategies', activeStrategies.join('; ')],
      ]
      wb.SheetNames.push('Assumptions')
      wb.Sheets['Assumptions'] = XLSX.utils.aoa_to_sheet(assumptions)

      const projHeaders = ['Year', 'Age P1', 'Age P2', 'Gross Estate', 'Federal Tax', 'State Tax', 'Net to Heirs']
      const projRows = projectionData.map((r) => [
        r.year,
        r.age_p1,
        r.age_p2 ?? '',
        r.gross_estate,
        r.federal_tax,
        r.state_tax,
        r.net_to_heirs,
      ])
      wb.SheetNames.push('Projection')
      wb.Sheets['Projection'] = XLSX.utils.aoa_to_sheet([projHeaders, ...projRows])

      const taxRows: (string | number)[][] = [['Metric', 'Value']]
      if (taxSummary) {
        taxRows.push(['Federal Tax - Current Law', taxSummary.federal_tax_current])
        taxRows.push([`${taxSummary.state_name} State Tax`, taxSummary.state_tax])
      }
      wb.SheetNames.push('Tax Analysis')
      wb.Sheets['Tax Analysis'] = XLSX.utils.aoa_to_sheet(taxRows)

      const stratRows = [['Strategy'], ...activeStrategies.map((s) => [s])]
      wb.SheetNames.push('Strategies')
      wb.Sheets['Strategies'] = XLSX.utils.aoa_to_sheet(stratRows)

      if (monteCarloRun && monteCarloResults) {
        const mcRows = [
          ['Metric', 'Value'],
          ['Paths', monteCarloResults.paths],
          ['P10 (Pessimistic)', monteCarloResults.p10],
          ['P50 (Base Case)', monteCarloResults.p50],
          ['P90 (Optimistic)', monteCarloResults.p90],
        ]
        wb.SheetNames.push('Monte Carlo')
        wb.Sheets['Monte Carlo'] = XLSX.utils.aoa_to_sheet(mcRows)
      }

      XLSX.writeFile(wb, `EstatePlan_Export_${new Date().toISOString().split('T')[0]}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePdfExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] text-white rounded-lg hover:bg-[#2d2d4e] transition-colors text-sm font-medium"
        >
          Export PDF Report
        </button>
        <button
          type="button"
          onClick={handleExcelExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {exporting ? 'Exporting...' : 'Export Excel (.xlsx)'}
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">PDF will include</p>
        <ul className="text-sm text-slate-700 space-y-1">
          <li>Cover page {advisorName ? `(Advisor: ${advisorName})` : ''}</li>
          <li>Estate snapshot ({projectionData.length} projection years)</li>
          <li>{taxSummary ? 'Tax analysis' : 'Tax analysis (no tax data)'}</li>
          <li>
            {activeStrategies.length > 0 ? 'Strategy summary' : 'Strategy summary (no active strategies)'} (
            {activeStrategies.length} strategies)
          </li>
          <li>
            {monteCarloRun && monteCarloResults ? 'Monte Carlo' : 'Monte Carlo (not yet run)'}
          </li>
          <li>
            {liquidityShortfall ? 'Liquidity analysis' : 'Liquidity analysis (no shortfall detected)'}
          </li>
          <li>
            {actionItems.length > 0 ? 'Action items' : 'Action items (no open alerts)'} ({actionItems.length}{' '}
            items)
          </li>
        </ul>
      </div>

      {scenarioHistory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Scenario Version History</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Label</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Gross Estate</th>
                </tr>
              </thead>
              <tbody>
                {scenarioHistory.map((v, i) => (
                  <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-2 text-slate-600">
                      {v.created_at
                        ? new Date(v.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-2 text-slate-800">{v.label || 'Base Case'}</td>
                    <td className="px-4 py-2 text-right text-slate-800">{fmt(v.gross_estate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DisclaimerBanner />
    </div>
  )
}
