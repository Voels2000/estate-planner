'use client'

import { useState, useRef } from 'react'
import { ExportPDFButton } from '@/components/pdf/ExportPDFButton'
import { AttorneyUpgradePrompt } from '@/components/attorney/AttorneyUpgradePrompt'
import {
  DOC_STATUS_OPTIONS,
  DOC_STATUS_STYLES,
  DOC_TYPE_FILTER_OPTIONS,
  filterDocumentsByType,
  type DocumentGapAlert,
} from '@/lib/attorney/getMissingDocumentAlerts'

type Document = {
  id: string
  document_type: string
  file_name: string
  version: number
  is_current: boolean
  uploader_role: string
  created_at: string
  doc_status?: string | null
  executed_date?: string | null
  status_notes?: string | null
}

type Props = {
  householdId: string
  attorneyId: string
  documents: Document[]
  documentGaps?: DocumentGapAlert[]
  canExportIntake?: boolean
}

const DOCTYPE_LABELS: Record<string, string> = {
  will: 'Will',
  trust: 'Trust',
  dpoa: 'DPOA',
  medical_poa: 'Medical POA',
  advance_directive: 'Advance Directive',
  living_will: 'Living Will',
  deed: 'Deed',
  titling: 'Titling',
  correspondence: 'Correspondence',
  other: 'Other',
}

export function AttorneyClientVault({
  householdId,
  attorneyId,
  documents: initialDocs,
  documentGaps = [],
  canExportIntake = false,
}: Props) {
  const [docs, setDocs] = useState<Document[]>(initialDocs)
  const [gaps, setGaps] = useState(documentGaps)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [docType, setDocType] = useState('will')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const filteredDocs = filterDocumentsByType(docs, typeFilter)

  async function handleUpload() {
    setUploadError(null)
    setUploadSuccess(null)
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setUploadError('Please select a PDF file.')
      return
    }
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are accepted.')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('household_id', householdId)
      form.append('document_type', docType)
      form.append('attorney_id', attorneyId)

      const res = await fetch('/api/documents/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error ?? 'Upload failed.')
      } else {
        setUploadSuccess(`${file.name} uploaded successfully.`)
        const updated = await fetch(`/api/documents/household/${householdId}`)
        const updatedData = await updated.json()
        if (updatedData.documents) setDocs(updatedData.documents)
        if (fileRef.current) fileRef.current.value = ''
      }
    } catch {
      setUploadError('An unexpected error occurred.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(documentId: string) {
    try {
      const res = await fetch(`/api/documents/download/${documentId}`)
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Download failed.')
        return
      }
      window.open(data.url, '_blank')
    } catch {
      alert('An unexpected error occurred.')
    }
  }

  async function updateDocStatus(documentId: string, doc_status: string) {
    setStatusUpdating(documentId)
    try {
      const res = await fetch(`/api/documents/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Update failed')
      setDocs((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, doc_status: data.doc_status } : d)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setStatusUpdating(null)
    }
  }

  async function dismissGap(gapKey: string) {
    const note = window.prompt('Optional note (e.g. held at prior firm):') ?? ''
    const res = await fetch('/api/attorney/gap-dismissals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ household_id: householdId, gap_key: gapKey, note }),
    })
    if (res.ok) {
      setGaps((prev) => prev.filter((g) => g.gap_key !== gapKey))
    }
  }

  return (
    <div className="space-y-6">
      {gaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber-900 mb-1">Document Gaps</h2>
          <p className="text-sm text-amber-700 mb-4">
            Common estate documents not yet on file for this client.
          </p>
          <ul className="space-y-2">
            {gaps.map((gap) => (
              <li
                key={gap.gap_key}
                className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2"
              >
                <span className="text-sm text-neutral-800">{gap.label}</span>
                <button
                  type="button"
                  onClick={() => dismissGap(gap.gap_key)}
                  className="text-xs text-amber-700 hover:underline whitespace-nowrap"
                >
                  Mark completed elsewhere
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">📁 Document Vault</h2>
            <p className="text-sm text-neutral-400">
              Upload legal documents for this client. All uploads are timestamped and logged.
            </p>
          </div>
          <div className="text-right">
            {canExportIntake ? (
              <ExportPDFButton householdId={householdId} role="advisor" variant="attorney" />
            ) : (
              <AttorneyUpgradePrompt feature="pdf_export" />
            )}
            <p className="text-[10px] text-neutral-400 mt-1 max-w-xs">
              Prepared by the client using My Wealth Maps for attorney reference only — not legal
              advice.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {DOC_TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                typeFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-neutral-700 mb-3">Upload a document</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(DOCTYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="text-sm text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-neutral-200 file:text-sm file:bg-white flex-1"
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {uploading ? 'Uploading...' : '⬆️ Upload PDF'}
            </button>
          </div>
          {uploadError && <p className="text-red-500 text-xs mt-2">{uploadError}</p>}
          {uploadSuccess && <p className="text-green-600 text-xs mt-2">✅ {uploadSuccess}</p>}
        </div>

        {filteredDocs.length === 0 ? (
          <div className="text-center py-10 text-neutral-400">
            <p className="text-2xl mb-2">📄</p>
            <p className="text-sm">No documents in this filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map((doc) => {
              const status = doc.doc_status ?? 'uploaded'
              return (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">📄</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">
                        {doc.file_name}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {DOCTYPE_LABELS[doc.document_type] ?? doc.document_type}
                        {' · '}v{doc.version}
                        {' · '}
                        {doc.uploader_role === 'attorney' ? '⚖️ Attorney' : '👤 Client'}
                        {' · '}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={status}
                      disabled={statusUpdating === doc.id}
                      onChange={(e) => updateDocStatus(doc.id, e.target.value)}
                      className={`text-xs rounded-full px-2 py-1 border-0 font-medium ${DOC_STATUS_STYLES[status] ?? DOC_STATUS_STYLES.uploaded}`}
                    >
                      {DOC_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50"
                    >
                      ⬇️ Download
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
