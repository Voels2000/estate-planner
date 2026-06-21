'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ATTORNEY_DOC_REQUEST_TYPES } from '@/lib/attorney/matterWorkflow'

type DocRequest = {
  id: string
  document_type: string
  message: string | null
  requested_at: string
  attorney_listings?: { firm_name: string | null; contact_name: string | null } | null
}

export function ConsumerAttorneyDocumentRequests({
  initialRequests,
}: {
  initialRequests: DocRequest[]
}) {
  const [requests, setRequests] = useState(initialRequests)

  if (requests.length === 0) return null

  const label = (type: string) =>
    ATTORNEY_DOC_REQUEST_TYPES.find((d) => d.value === type)?.label ?? type

  async function dismiss(id: string) {
    const res = await fetch('/api/attorney/document-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'cancel' }),
    })
    if (res.ok) setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-amber-900">Documents requested by your attorney</h2>
      <p className="text-xs text-amber-800">
        You own your data — upload documents in your vault or share with your attorney when ready.
      </p>
      <ul className="space-y-2">
        {requests.map((r) => {
          const firm =
            r.attorney_listings?.firm_name ?? r.attorney_listings?.contact_name ?? 'Your attorney'
          return (
            <li key={r.id} className="rounded-lg bg-white border border-amber-100 px-3 py-2 text-sm">
              <p className="font-medium text-gray-900">
                {label(r.document_type)} <span className="text-gray-500 font-normal">· {firm}</span>
              </p>
              {r.message && <p className="text-xs text-gray-600 mt-0.5">{r.message}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href="/settings/attorney-access"
                  className="text-xs font-medium text-[color:var(--mwm-navy)] hover:underline"
                >
                  Open document vault
                </Link>
                <button
                  type="button"
                  onClick={() => void dismiss(r.id)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
