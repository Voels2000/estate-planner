'use client'

import { useState } from 'react'
import {
  ATTORNEY_CLIENT_STATUSES,
  ATTORNEY_MATTER_STAGES,
  type AttorneyClientStatus,
  type AttorneyMatterStage,
} from '@/lib/attorney/matterWorkflow'

export function AttorneyClientWorkflowPanel({
  householdId,
  initialMatterStage,
  initialClientStatus,
}: {
  householdId: string
  initialMatterStage: AttorneyMatterStage
  initialClientStatus: AttorneyClientStatus
}) {
  const [matterStage, setMatterStage] = useState(initialMatterStage)
  const [clientStatus, setClientStatus] = useState(initialClientStatus)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(patch: { matter_stage?: AttorneyMatterStage; client_status?: AttorneyClientStatus }) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/attorney/matter', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_id: householdId, ...patch }),
      })
      if (!res.ok) throw new Error('Unable to save')
      setMessage('Saved')
    } catch {
      setMessage('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Matter workflow
        </h2>
        <p className="text-xs text-neutral-500 mt-1">
          Track engagement stage for your firm. Does not change the client&apos;s estate data.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block text-xs font-medium text-neutral-600">
          Matter stage
          <select
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            value={matterStage}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value as AttorneyMatterStage
              setMatterStage(v)
              void save({ matter_stage: v })
            }}
          >
            {ATTORNEY_MATTER_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Client status
          <select
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            value={clientStatus}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value as AttorneyClientStatus
              setClientStatus(v)
              void save({ client_status: v })
            }}
          >
            {ATTORNEY_CLIENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message && <p className="text-xs text-neutral-500">{message}</p>}
    </div>
  )
}
