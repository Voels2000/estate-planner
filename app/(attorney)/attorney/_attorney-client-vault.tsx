'use client'

import { useState, useRef } from 'react'

type Document = {
  id:            string
  document_type: string
  file_name:     string
  version:       number
  is_current:    boolean
  uploader_role: string
  created_at:    string
}

type Props = {
  householdId: string
  attorneyId:  string
  documents:   Document[]
}

const DOCTYPE_LABELS: Record<string, string> = {
  will:              'Will',
  trust:             'Trust',
  dpoa:              'DPOA',
  medical_poa:       'Medical POA',
  advance_directive: 'Advance Directive',
  living_will:       'Living Will',
  deed:              'Deed',
  titling:           'Titling',
  correspondence:    'Correspondence',
  other:             'Other',
}

export function AttorneyClientVault({ householdId, attorneyId, documents }: Props) {
  const [docs, setDocs]                     = useState<Document[]>(documents)
  const [uploading, setUploading]           = useState(false)
  const [uploadError, setUploadError]       = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess]   = useState<string | null>(null)
  const [docType, setDocType]               = useState('will')
  const fileRef                             = useRef<HTMLInputElement>(null)

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
      form.append('file',          file)
      form.append('household_id',  householdId)
      form.append('document_type', docType)
      form.append('attorney_id',   attorneyId)

      const res  = await fetch('/api/documents/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error ?? 'Upload failed.')
      } else {
        setUploadSuccess(`${file.name} uploaded successfully.`)
        const updated     = await fetch(`/api/documents/${householdId}`)
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
      const res  = await fetch(`/api/documents/download/${documentId}`)
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
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-1">📁 Document Vault</h2>
      <p className="text-sm text-neutral-400 mb-6">
        Upload legal documents for this client. All uploads are timestamped and logged.
      </p>

      {/* Upload panel */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-neutral-700 mb-3">Upload a document</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={docType}
            onChange={e => setDocType(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm
                       bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(DOCTYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="text-sm text-neutral-600 file:mr-3 file:py-1.5 file:px-3
                       file:rounded-lg file:border file:border-neutral-200
                       file:text-sm file:bg-white file:text-neutral-700
                       hover:file:bg-neutral-50 flex-1"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       whitespace-nowrap"
          >
            {uploading ? 'Uploading...' : '⬆️ Upload PDF'}
          </button>
        </div>
        {uploadError   && <p className="text-red-500 text-xs mt-2">{uploadError}</p>}
        {uploadSuccess && <p className="text-green-600 text-xs mt-2">✅ {uploadSuccess}</p>}
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="text-center py-10 text-neutral-400">
          <p className="text-2xl mb-2">📄</p>
          <p className="text-sm">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 border
                         border-neutral-200 rounded-lg hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📄</span>
                <div>
                  <p className="text-sm font-medium text-neutral-800">{doc.file_name}</p>
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
              <button
                onClick={() => handleDownload(doc.id)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3
                           py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                ⬇️ Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
