'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { AdvisorEstatePlanPDF, ConsumerEstatePlanPDF, AttorneyEstatePlanPDF } from './EstatePlanPDF'
import { Button } from '@/components/ui/Button'
import { formErrorClass } from '@/components/ui/form'

const DownloadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
    />
  </svg>
)

interface ExportPDFButtonProps {
  householdId: string
  role: 'advisor' | 'consumer'
  /** Attorney-ready summary layout; PDF template can branch on this later. */
  variant?: 'attorney'
  className?: string
}

export function ExportPDFButton({ householdId, role, variant, className }: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ household_id: householdId })
      if (variant === 'attorney') params.set('variant', 'attorney')
      const res = await fetch(`/api/export-estate-plan?${params.toString()}`)

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? `Request failed with status ${res.status}`)
      }

      const data = await res.json()

      const doc =
        variant === 'attorney' ? (
          <AttorneyEstatePlanPDF data={data} />
        ) : role === 'advisor' ? (
          <AdvisorEstatePlanPDF data={data} />
        ) : (
          <ConsumerEstatePlanPDF data={data} />
        )

      const blob = await pdf(doc).toBlob()

      const clientName = [data.household?.person1_last_name, data.household?.person2_last_name]
        .filter(Boolean)
        .join('-')

      const prefix = variant === 'attorney' ? 'AttorneySummary' : 'EstatePlan'
      const filename = `${prefix}-${clientName || 'Export'}-${new Date().toISOString().slice(0, 10)}.pdf`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      console.error('[ExportPDFButton]', err)
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const label = variant === 'attorney' ? 'Export Attorney Summary' : 'Export Estate Plan PDF'

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="primary"
        size="md"
        loading={loading}
        onClick={handleExport}
        className={className}
      >
        {!loading && <DownloadIcon />}
        {loading ? 'Generating PDF…' : label}
      </Button>
      {error && <p className={formErrorClass}>{error}</p>}
    </div>
  )
}
