'use client'

import { useState } from 'react'
import { ATTORNEY_DOC_REQUEST_TYPES } from '@/lib/attorney/matterWorkflow'

type DocRequest = {
  id: string
  document_type: string
  message: string | null
  status: string
  requested_at: string
}

export function AttorneyDocumentRequestsPanel({
  householdId,
  initialRequests = [],
}: {
  householdId: string
  initialRequests?: DocRequest[]
}) {
  const [requests, setRequests] = useState(initialRequests)
  const [documentType, setDocumentType] = useState('will')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const label = (type: string) =>
    ATTORNEY_DOC_REQUEST_TYPES.find((d) => d.value === type)?.label ?? type

  async function handleCreate() {
    setSaving(true)
    try {
      const res = await fetch('/api/attorney/document-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          document_type: documentType,
          message,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setRequests((prev) => [data, ...prev])
        setMessage('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function patchRequest(id: string, action: 'fulfill' | 'cancel') {
    const res = await fetch('/api/attorney/document-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (res.ok) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: action === 'fulfill' ? 'fulfilled' : 'cancelled' } : r,
        ),
      )
    }
  }

  const pending = requests.filter((r) => r.status === 'pending')

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Document requests
        </h2>
        <p className="text-xs text-neutral-500 mt-1">
          Ask the client to upload or provide documents. They retain ownership — you can upload
          executed copies to the vault below.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs font-medium text-neutral-600">
          Document
          <select
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            {ATTORNEY_DOC_REQUEST_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-[200px] text-xs font-medium text-neutral-600">
          Message (optional)
          <input
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Please upload signed copy"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleCreate()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Request document
        </button>
      </div>
      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{label(r.document_type)}</span>
                {r.message && <p className="text-xs text-neutral-600 mt-0.5">{r.message}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void patchRequest(r.id, 'fulfill')}
                  className="text-xs text-green-700 hover:underline"
                >
                  Mark fulfilled
                </button>
                <button
                  type="button"
                  onClick={() => void patchRequest(r.id, 'cancel')}
                  className="text-xs text-neutral-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
