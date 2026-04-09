'use client'

// Sprint 73 — ExportPanel
// Advisor-facing export UI in StrategyTab or Meeting Prep tab
// PDF generation via browser print (window.print on hidden iframe)
// Excel generation via SheetJS (client-side, no server needed)
// Scenario version history table

import { useState } from 'react'
import { buildExcelWorkbook, ExcelExportData } from '@/lib/export/generateExcelExport'
import { generatePDFHTML, PDFReportData, determinePDFPages } from '@/lib/export/generatePDFReport'

interface ExportPanelProps {
  clientName: string
  pdfData: PDFReportData
  excelData: ExcelExportData
  scenarioHistory?: Array<{
    id: string
    label: string
    version: number
    scenario_type: string
    calculated_at: string
    gross_estate?: number
  }>
}

export default function ExportPanel({
  clientName,
  pdfData,
  excelData,
  scenarioHistory = [],
}: ExportPanelProps) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [pdfSuccess, setPdfSuccess] = useState(false)
  const [excelSuccess, setExcelSuccess] = useState(false)

  const includedPages = determinePDFPages(pdfData)

  const handlePDFExport = async () => {
    setPdfLoading(true)
    setPdfSuccess(false)
    try {
      const html = generatePDFHTML(pdfData)

      // Open in new window for browser print
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert('Please allow popups to generate the PDF report.')
        return
      }
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()

      // Trigger print after content loads
      setTimeout(() => {
        printWindow.print()
        setPdfSuccess(true)
      }, 500)
    } catch (err) {
      console.error('PDF export error:', err)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleExcelExport = async () => {
    setExcelLoading(true)
    setExcelSuccess(false)
    try {
      // Dynamically import SheetJS to avoid bundle size impact
      const XLSX = await import('xlsx')

      const { sheets } = buildExcelWorkbook(excelData)
      const wb = XLSX.utils.book_new()

      for (const [sheetName, rows] of Object.entries(sheets)) {
        const ws = XLSX.utils.aoa_to_sheet(rows as unknown[][])

        // Column widths
        ws['!cols'] = Array(10).fill({ wch: 20 })

        XLSX.utils.book_append_sheet(wb, ws, sheetName)
      }

      // Download
      const filename = `${clientName.replace(/\s+/g, '_')}_EstatePlan_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
      setExcelSuccess(true)
    } catch (err) {
      console.error('Excel export error:', err)
    } finally {
      setExcelLoading(false)
    }
  }

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

  return (
    <div className="space-y-6">

      {/* Export buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* PDF Export */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-1">
            📄 Advisor PDF Report
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            {includedPages.length}-page report including{' '}
            {includedPages.includes('monte_carlo') ? 'Monte Carlo analysis, ' : ''}
            {includedPages.includes('strategy_summary') ? 'strategy summary, ' : ''}
            tax analysis, and action items.
          </p>
          <div className="text-xs text-gray-400 mb-3">
            Pages: {includedPages.map(p => p.replace('_', ' ')).join(' · ')}
          </div>
          <button
            onClick={handlePDFExport}
            disabled={pdfLoading}
            className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              pdfLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {pdfLoading ? 'Generating...' : 'Export PDF Report'}
          </button>
          {pdfSuccess && (
            <p className="text-xs text-green-600 mt-2">
              ✓ Report opened in new tab — use browser Print to save as PDF
            </p>
          )}
        </div>

        {/* Excel Export */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-1">
            📊 Excel Export
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Workbook with Assumptions, Projection, Tax Analysis, Strategies
            {excelData.monteCarlo ? ', and Monte Carlo' : ''} sheets.
            Values only — no formulas.
          </p>
          <div className="text-xs text-gray-400 mb-3">
            Sheets: {['Assumptions', 'Projection', 'Tax Analysis', 'Strategies', ...(excelData.monteCarlo ? ['Monte Carlo'] : [])].join(' · ')}
          </div>
          <button
            onClick={handleExcelExport}
            disabled={excelLoading}
            className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              excelLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {excelLoading ? 'Generating...' : 'Export Excel Workbook'}
          </button>
          {excelSuccess && (
            <p className="text-xs text-green-600 mt-2">
              ✓ Excel file downloaded
            </p>
          )}
        </div>
      </div>

      {/* Scenario Version History */}
      {scenarioHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-800 mb-3">
            Scenario Version History
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Label</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Type</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Version</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Estate</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Calculated</th>
                </tr>
              </thead>
              <tbody>
                {scenarioHistory.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700">{s.label}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{s.scenario_type}</td>
                    <td className="py-2 px-3 text-right text-gray-500">v{s.version}</td>
                    <td className="py-2 px-3 text-right">
                      {s.gross_estate ? fmt(s.gross_estate) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-400 text-xs">
                      {new Date(s.calculated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
