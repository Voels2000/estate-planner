'use client'

import { useMemo, useState } from 'react'

type Attorney = {
  id: string
  attorney_id: string | null
  firm_name: string
  contact_name: string | null
  email: string
  website: string | null
  city: string | null
  state: string | null
  bio: string | null
  credentials: string[] | null
  specializations: string[] | null
  fee_structure: string | null
  serves_remote: boolean
  languages: string[]
  is_verified: boolean
}

type Props = {
  attorneys: Attorney[]
  allSpecializations: string[]
  allStates: string[]
  userRole: string | null
}

export function AttorneyDirectoryClient({
  attorneys,
  allSpecializations,
  allStates,
  userRole,
}: Props) {
  const [search, setSearch] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [selectedSpec, setSelectedSpec] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)

  // Request to Connect state
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [modalAttorney, setModalAttorney] = useState<Attorney | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)

  // Request to Add state
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestName, setRequestName] = useState('')
  const [requestFirm, setRequestFirm] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestNote, setRequestNote] = useState('')
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSent, setRequestSent] = useState(false)

  async function submitRequestToAdd() {
    if (!requestName || !requestFirm || !requestEmail) {
      setRequestError('Name, firm, and email are required.')
      return
    }
    setRequestSubmitting(true)
    setRequestError(null)
    try {
      const res = await fetch('/api/attorney-directory/request-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: requestName,
          firm_name: requestFirm,
          email: requestEmail,
          note: requestNote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRequestError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setRequestSent(true)
    } catch {
      setRequestError('Something went wrong. Please try again.')
    } finally {
      setRequestSubmitting(false)
    }
  }

  const isConsumer = userRole === 'consumer'

  const filtered = useMemo(() => {
    return attorneys.filter(a => {
      if (search) {
        const q = search.toLowerCase()
        const matches =
          a.firm_name.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q) ||
          a.bio?.toLowerCase().includes(q) ||
          a.contact_name?.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (selectedState && a.state !== selectedState) return false
      if (selectedSpec && !(a.specializations ?? []).includes(selectedSpec)) return false
      if (remoteOnly && !a.serves_remote) return false
      return true
    })
  }, [attorneys, search, selectedState, selectedSpec, remoteOnly])

  function clearFilters() {
    setSearch('')
    setSelectedState('')
    setSelectedSpec('')
    setRemoteOnly(false)
  }

  function openModal(attorney: Attorney) {
    setModalAttorney(attorney)
    setMessage('')
    setModalError(null)
  }

  function closeModal() {
    setModalAttorney(null)
    setMessage('')
    setModalError(null)
    setConsentChecked(false)
  }

  async function submitRequest() {
    if (!modalAttorney) return
    if (!consentChecked) {
      setModalError('Please confirm your consent before granting access.')
      return
    }
    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch('/api/attorney/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attorney_id: modalAttorney.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (
          res.status === 404 &&
          typeof data.error === 'string' &&
          data.error.startsWith('Household not found')
        ) {
          setModalError(
            'Please complete your profile before connecting with an attorney. Go to Profile to get started.'
          )
        } else {
          setModalError(data.error ?? 'Something went wrong. Please try again.')
        }
        return
      }
      setRequestedIds(prev => new Set(prev).add(modalAttorney.id))
      closeModal()
    } catch {
      setModalError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const hasFilters = search || selectedState || selectedSpec || remoteOnly

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Find an Estate Planning Attorney</h1>
        <p className="mt-2 text-neutral-600">
          Browse our network of estate planning attorneys. Request a referral when you are ready to connect.
        </p>
      </div>

      <div className="mb-8 rounded-2xl bg-white border border-neutral-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by name, city, or keyword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="col-span-1 md:col-span-3 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
          <select
            value={selectedState}
            onChange={e => setSelectedState(e.target.value)}
            className="rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="">All States</option>
            {allStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={selectedSpec}
            onChange={e => setSelectedSpec(e.target.value)}
            className="rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="">All Specializations</option>
            {allSpecializations.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex items-center md:col-span-1">
            <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={e => setRemoteOnly(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Remote / virtual only
            </label>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        {filtered.length} {filtered.length === 1 ? 'attorney' : 'attorneys'} found
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-neutral-200 p-12 text-center">
          <p className="text-neutral-500">No attorneys match your filters.</p>
          <button type="button" onClick={clearFilters} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(attorney => {
            const hasRequested = requestedIds.has(attorney.id)
            return (
              <div
                key={attorney.id}
                className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 hover:shadow-md hover:border-neutral-300 transition-all"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-neutral-900">{attorney.firm_name}</h2>
                      {attorney.is_verified && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Verified
                        </span>
                      )}
                      {attorney.serves_remote && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                          Remote
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-neutral-500">
                      {[attorney.city, attorney.state].filter(Boolean).join(', ')}
                      {attorney.contact_name ? ` · ${attorney.contact_name}` : ''}
                    </p>
                    {attorney.bio && (
                      <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{attorney.bio}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(attorney.credentials ?? []).map(c => (
                        <span key={c} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                          {c}
                        </span>
                      ))}
                      {(attorney.specializations ?? []).map(s => (
                        <span key={s} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    {attorney.fee_structure && (
                      <p className="text-sm font-medium text-neutral-900 sm:text-right">{attorney.fee_structure}</p>
                    )}
                    {isConsumer ? (
                      hasRequested ? (
                        <span className="inline-flex justify-center rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700 text-center">
                          ✓ Request sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openModal(attorney)}
                          className="inline-flex justify-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition text-center"
                        >
                          Request to Connect
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Request to Add section — consumers only */}
      {isConsumer && (
        <div className="mt-12 rounded-2xl bg-white border border-neutral-200 shadow-sm p-8">
          {!requestSent ? (
            <>
              <h2 className="text-lg font-semibold text-neutral-900 mb-1">
                Don&apos;t see your attorney?
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                Submit their details and we will send them an invitation to join the platform.
                You will be notified by email and in-app once they sign up so you can connect.
              </p>

              {!showRequestForm ? (
                <button
                  type="button"
                  onClick={() => setShowRequestForm(true)}
                  className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                >
                  + Request an attorney
                </button>
              ) : (
                <div className="space-y-4 max-w-lg">
                  {requestError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {requestError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Attorney name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={requestName}
                      onChange={e => setRequestName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Firm name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={requestFirm}
                      onChange={e => setRequestFirm(e.target.value)}
                      placeholder="Smith & Associates"
                      className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Attorney email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={requestEmail}
                      onChange={e => setRequestEmail(e.target.value)}
                      placeholder="jane@smithlaw.com"
                      className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Optional note
                    </label>
                    <textarea
                      value={requestNote}
                      onChange={e => setRequestNote(e.target.value)}
                      rows={3}
                      placeholder="Any context you'd like to share with the attorney..."
                      className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRequestForm(false)
                        setRequestError(null)
                      }}
                      className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitRequestToAdd}
                      disabled={requestSubmitting}
                      className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {requestSubmitting ? 'Sending invitation…' : 'Send invitation'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-2xl mb-3">✅</p>
              <p className="font-medium text-neutral-900">Invitation sent</p>
              <p className="mt-1 text-sm text-neutral-500">
                We have sent an invitation to the attorney. You will receive an email and
                in-app notification as soon as they join the platform.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Request to Connect Modal */}
      {modalAttorney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">
              Request to Connect
            </h2>
            <p className="text-sm text-neutral-500 mb-4">
              You are about to grant <strong>{modalAttorney.firm_name}</strong> read-only
              access to your estate plan and document vault. You can revoke this access
              at any time from <strong>Settings → My Attorney</strong>.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800 space-y-1">
              <p>⚖️ <strong>What this attorney will be able to do:</strong></p>
              <p>✅ View your estate plan summary</p>
              <p>✅ Upload legal documents to your vault</p>
              <p>✅ Download documents from your vault</p>
              <p>❌ Make changes to your estate plan</p>
              <p>❌ See your login credentials or billing information</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-700">
                I understand and consent to granting <strong>{modalAttorney.firm_name}</strong> read-only
                access to my estate plan and document vault.
              </span>
            </label>
            {modalError && (
              <p className="mt-2 text-sm text-red-600">{modalError}</p>
            )}
            <div className="mt-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={submitting}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Granting access…' : 'Grant Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
