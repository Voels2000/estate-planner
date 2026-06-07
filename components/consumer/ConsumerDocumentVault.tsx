'use client'

import { useRef, useState } from 'react'
import { hasPaidDownloadAccess } from '@/lib/access/requirePaidDownloadAccess'

type Document = {
  id: string
  document_type: string
  file_name: string
  version: number
  is_current: boolean
  uploader_role: string
  uploaded_at: string
  can_download?: boolean
}

type Props = {
  householdId: string
  linkedAttorneyId: string | null
  documents: Document[]
  subscriptionStatus: string | null
  consumerTier: number | null
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

const UPLOAD_TYPES = [
  'will',
  'trust',
  'dpoa',
  'medical_poa',
  'advance_directive',
  'living_will',
  'deed',
  'titling',
  'correspondence',
  'other',
] as const

export function ConsumerDocumentVault({
  householdId,
  linkedAttorneyId,
  documents: initialDocs,
  subscriptionStatus,
  consumerTier,
}: Props) {
  const [docs, setDocs] = useState(initialDocs)
  const [docType, setDocType] = useState<string>('will')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canDownload = hasPaidDownloadAccess(
    { role: 'consumer', consumer_tier: consumerTier, subscription_status: subscriptionStatus },
    1,
  )

  async function refreshDocs() {
    const res = await fetch(`/api/documents/household/${householdId}`)
    const data = await res.json()
    if (data.documents) setDocs(data.documents)
  }

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
      if (linkedAttorneyId) form.append('attorney_id', linkedAttorneyId)

      const res = await fetch('/api/documents/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error ?? 'Upload failed.')
        return
      }
      setUploadSuccess(`${file.name} uploaded successfully.`)
      await refreshDocs()
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setUploadError('An unexpected error occurred.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(documentId: string) {
    if (!canDownload) {
      alert('A paid subscription is required to download documents.')
      return
    }
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[color:var(--mwm-border)] bg-white p-6">
        <h2 className="text-lg font-semibold text-[color:var(--mwm-navy)] mb-1">Upload a document</h2>
        <p className="text-sm text-[color:var(--mwm-text-secondary)] mb-4">
          Store PDF copies of wills, trusts, POAs, and other estate documents. Your linked attorney can
          view uploads when you grant access.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            Document type
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 min-w-[180px]"
            >
              {UPLOAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCTYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            PDF file
            <input ref={fileRef} type="file" accept="application/pdf" className="text-sm" />
          </label>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-lg bg-[color:var(--mwm-navy)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {uploadError && <p className="text-sm text-red-600 mt-3">{uploadError}</p>}
        {uploadSuccess && <p className="text-sm text-green-700 mt-3">{uploadSuccess}</p>}
      </div>

      <div className="rounded-xl border border-[color:var(--mwm-border)] bg-white p-6">
        <h2 className="text-lg font-semibold text-[color:var(--mwm-navy)] mb-4">Your vault</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-[color:var(--mwm-text-secondary)]">
            No documents yet. Upload PDFs above or ask your attorney to add files.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <li key={doc.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
                    {DOCTYPE_LABELS[doc.document_type] ?? doc.document_type} — v{doc.version}
                  </p>
                  <p className="text-xs text-[color:var(--mwm-text-muted)]">
                    {doc.file_name} · {doc.uploader_role} ·{' '}
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(doc.id)}
                  disabled={!canDownload && doc.can_download !== true}
                  className="text-sm text-[color:var(--mwm-navy)] underline disabled:opacity-40 disabled:no-underline"
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
        {!canDownload && docs.length > 0 && (
          <p className="text-xs text-amber-800 mt-4">
            Downloads require an active paid subscription. You can still upload documents.
          </p>
        )}
      </div>
    </div>
  )
}
