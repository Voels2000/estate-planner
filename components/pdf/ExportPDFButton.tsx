// components/PDF/ExportPDFButton.tsx
'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { AdvisorEstatePlanPDF, ConsumerEstatePlanPDF } from './EstatePlanPDF'

interface ExportPDFButtonProps {
  householdId: string
  role: 'advisor' | 'consumer'
  className?: string
}

export function ExportPDFButton({ householdId, role, className }: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch assembled plan data from API route
      const res = await fetch(`/api/export-estate-plan?household_id=${householdId}`)

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? `Request failed with status ${res.status}`)
      }

      const data = await res.json()

      // 2. Pick the right PDF component based on role
      const doc = role === 'advisor'
        ? <AdvisorEstatePlanPDF data={data} />
        : <ConsumerEstatePlanPDF data={data} />

      // 3. Render PDF to blob in the browser (no server cost)
      const blob = await pdf(doc).toBlob()

      // 4. Trigger download
      const clientName = [
        data.household?.person1_last_name,
        data.household?.person2_last_name,
      ].filter(Boolean).join('-')

      const filename = `EstatePlan-${clientName || 'Export'}-${new Date().toISOString().slice(0, 10)}.pdf`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

    } catch (err: any) {
      console.error('[ExportPDFButton]', err)
      setError(err.message ?? 'Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleExport}
        disabled={loading}
        className={className ?? 'inline-flex items-center gap-2 rounded-md bg-[#1B2A4A] px-4 py-2 text-sm font-medium text-white hover:bg-[#2E4270] disabled:opacity-50 disabled:cursor-not-allowed transition-colors'}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Generating PDF...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export Estate Plan PDF
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
