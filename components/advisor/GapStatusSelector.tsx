'use client'

import { useState } from 'react'

export type GapStatus = 'open' | 'discussed' | 'deferred' | 'resolved'

const STATUS_CONFIG: Record<GapStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'text-gray-600 bg-gray-100' },
  discussed: { label: 'Discussed', className: 'text-blue-700 bg-blue-50' },
  deferred: { label: 'Deferred', className: 'text-amber-700 bg-amber-50' },
  resolved: { label: 'Resolved', className: 'text-green-700 bg-green-50' },
}

type Props = {
  clientId: string
  gapKey: string
  initialStatus: GapStatus
}

export function GapStatusSelector({ clientId, gapKey, initialStatus }: Props) {
  const [status, setStatus] = useState<GapStatus>(initialStatus)
  const [saving, setSaving] = useState(false)

  const handleChange = async (newStatus: GapStatus) => {
    setSaving(true)
    setStatus(newStatus)
    try {
      await fetch('/api/advisor/gap-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, gapKey, status: newStatus }),
      })
    } finally {
      setSaving(false)
    }
  }

  const { label, className } = STATUS_CONFIG[status]

  return (
    <div className="relative shrink-0">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as GapStatus)}
        disabled={saving}
        aria-label={`Gap status: ${label}`}
        className={`text-xs font-medium rounded-full px-3 py-1 border-0 cursor-pointer appearance-none pr-6 ${className} ${saving ? 'opacity-50' : ''}`}
      >
        {(Object.keys(STATUS_CONFIG) as GapStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_CONFIG[s].label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-60 text-[10px]"
        aria-hidden
      >
        ▾
      </span>
    </div>
  )
}
