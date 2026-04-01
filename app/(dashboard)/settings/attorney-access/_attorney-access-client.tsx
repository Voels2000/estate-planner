'use client'

import { useState } from 'react'

type AttorneyConnection = {
  connection_id: string
  attorney_id: string
  contact_name: string
  firm_name: string
  email: string
  state: string
  granted_at: string | null
  advisor_pdf_access: boolean
  advisor_pdf_access_granted_at: string | null
}

type Props = {
  attorneyConnections: AttorneyConnection[]
  advisorConnectionId: string | null
  advisorPdfAccess: boolean
  householdId: string
}

export function AttorneyAccessClient({
  attorneyConnections,
  advisorConnectionId,
  advisorPdfAccess: initialAdvisorPdfAccess,
  householdId,
}: Props) {
  const [connections, setConnections] = useState(attorneyConnections)
  const [advisorPdfAccess, setAdvisorPdfAccess] = useState(initialAdvisorPdfAccess)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [togglingPdf, setTogglingPdf] = useState<string | null>(null)
  const [advisorToggeling, setAdvisorToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Revoke attorney access ─────────────────────────────────
  async function handleRevoke(connectionId: string, name: string) {
    if (
      !confirm(
        `Revoke access for ${name}? They will no longer be able to view your estate plan or upload documents.`
      )
    )
      return

    setRevoking(connectionId)
    setError(null)

    try {
      const res = await fetch('/api/attorney/revoke-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to revoke access.')
      } else {
        setConnections((prev) => prev.filter((c) => c.connection_id !== connectionId))
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setRevoking(null)
    }
  }

  // ── Toggle advisor PDF access ──────────────────────────────
  async function handleAdvisorPdfToggle() {
    if (!advisorConnectionId) return
    setAdvisorToggling(true)
    setError(null)

    try {
      const res = await fetch('/api/advisor/update-pdf-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisor_client_id: advisorConnectionId,
          pdf_access: !advisorPdfAccess,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to update advisor access.')
      } else {
        setAdvisorPdfAccess((prev) => !prev)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setAdvisorToggling(false)
    }
  }

  // ── Toggle attorney-level PDF access ──────────────────────
  async function handleAttorneyPdfToggle(connectionId: string, current: boolean) {
    setTogglingPdf(connectionId)
    setError(null)

    try {
      const res = await fetch('/api/attorney/update-pdf-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId, pdf_access: !current }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to update PDF access.')
      } else {
        setConnections((prev) =>
          prev.map((c) =>
            c.connection_id === connectionId ? { ...c, advisor_pdf_access: !current } : c
          )
        )
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setTogglingPdf(null)
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* ── Attorney connections ─────────────────────────────── */}
      <section>
        <h2 className="text-base font-medium text-gray-900 mb-1">Active Attorney Connections</h2>
        <p className="text-sm text-gray-500 mb-4">
          These attorneys currently have read-only access to your estate plan.
        </p>

        {connections.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 text-sm">
            <p className="text-2xl mb-2">⚖️</p>
            <p>No attorneys have access to your estate plan.</p>
            <a href="/attorney-directory" className="text-blue-600 hover:underline mt-2 inline-block">
              Browse the attorney directory →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div key={conn.connection_id} className="bg-white border border-gray-200 rounded-xl p-5">
                {/* Attorney info */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{conn.contact_name}</p>
                    {conn.firm_name && <p className="text-sm text-gray-500">{conn.firm_name}</p>}
                    <p className="text-sm text-gray-400">{conn.email}</p>
                    {conn.granted_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Access granted {new Date(conn.granted_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRevoke(conn.connection_id, conn.contact_name)}
                    disabled={revoking === conn.connection_id}
                    className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    {revoking === conn.connection_id ? 'Revoking...' : '🚫 Revoke Access'}
                  </button>
                </div>

                {/* PDF access toggle */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Allow document downloads</p>
                    <p className="text-xs text-gray-400">
                      Permit this attorney to download PDF documents from your vault
                    </p>
                  </div>
                  <button
                    onClick={() => handleAttorneyPdfToggle(conn.connection_id, conn.advisor_pdf_access)}
                    disabled={togglingPdf === conn.connection_id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      conn.advisor_pdf_access ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        conn.advisor_pdf_access ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Advisor PDF access ───────────────────────────────── */}
      {advisorConnectionId && (
        <section>
          <h2 className="text-base font-medium text-gray-900 mb-1">Advisor Document Access</h2>
          <p className="text-sm text-gray-500 mb-4">
            Control whether your advisor can download legal documents from your vault. They can
            always see document names and dates.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Allow advisor to download documents
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {advisorPdfAccess
                  ? 'Your advisor can currently download your legal documents.'
                  : 'Your advisor can see document names but cannot download files.'}
              </p>
            </div>
            <button
              onClick={handleAdvisorPdfToggle}
              disabled={advisorToggeling}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                advisorPdfAccess ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  advisorPdfAccess ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
