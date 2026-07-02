'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { US_STATES } from '@/lib/learn/us-states'
import {
  attorneyPracticeProfileCompletedCount,
  attorneyPracticeProfileMissingFields,
  isAttorneyPracticeProfileComplete,
} from '@/lib/attorney/attorneyListingPracticeProfile'
import {
  ATTORNEY_CREDENTIAL_SUGGESTIONS,
  ATTORNEY_FEE_STRUCTURE_OPTIONS,
  ATTORNEY_PRACTICE_AREAS,
  ATTORNEY_PRACTICE_PROFILE_FIELD_COUNT,
  normalizeAttorneyCredentials,
  normalizeAttorneyFeeStructure,
  normalizeAttorneySpecializations,
  normalizeLicensedStates,
} from '@/lib/attorney/attorneyPracticeOptions'

type Listing = {
  id: string
  firm_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  city: string | null
  state: string | null
  bar_number: string | null
  bio: string | null
  fee_structure: string | null
  specializations: string[]
  states_licensed: string[]
  credentials: string[]
}

function toListingState(raw: Listing & {
  specializations?: string[] | null
  states_licensed?: string[] | null
  credentials?: string[] | null
}): Listing {
  return {
    ...raw,
    specializations: normalizeAttorneySpecializations(raw.specializations ?? []),
    states_licensed: normalizeLicensedStates(raw.states_licensed ?? []),
    credentials: normalizeAttorneyCredentials(raw.credentials ?? []),
    fee_structure: normalizeAttorneyFeeStructure(raw.fee_structure) ?? raw.fee_structure,
  }
}

export function AttorneySettingsClient({ initialListing }: { initialListing: Listing | null }) {
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(
    initialListing ? toListingState(initialListing) : null,
  )
  const [credentialDraft, setCredentialDraft] = useState('')
  const [stateDraft, setStateDraft] = useState('')
  const [showCredentialAdd, setShowCredentialAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const practiceComplete = useMemo(
    () => (listing ? isAttorneyPracticeProfileComplete(listing) : false),
    [listing],
  )
  const practiceMissing = useMemo(
    () => (listing ? attorneyPracticeProfileMissingFields(listing) : []),
    [listing],
  )
  const practiceAddedCount = useMemo(
    () => (listing ? attorneyPracticeProfileCompletedCount(listing) : 0),
    [listing],
  )

  if (!listing) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-sm text-neutral-600">
          No directory listing linked to your account yet.{' '}
          <a
            href="/attorney-directory/register"
            className="text-[color:var(--mwm-navy)] underline hover:text-[color:var(--mwm-navy-light)]"
          >
            Register your practice
          </a>{' '}
          to appear in Find an Attorney.
        </p>
      </div>
    )
  }

  function toggleState(code: string) {
    setListing((prev) => {
      if (!prev) return prev
      const current = normalizeLicensedStates(prev.states_licensed)
      const next = current.includes(code)
        ? current.filter((s) => s !== code)
        : [...current, code]
      return { ...prev, states_licensed: next }
    })
  }

  function togglePracticeArea(slug: string) {
    setListing((prev) => {
      if (!prev) return prev
      const current = normalizeAttorneySpecializations(prev.specializations)
      const next = current.includes(slug as (typeof current)[number])
        ? current.filter((s) => s !== slug)
        : [...current, slug as (typeof current)[number]]
      return { ...prev, specializations: next }
    })
  }

  function addCredential(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    setListing((prev) => {
      if (!prev) return prev
      const next = normalizeAttorneyCredentials([...prev.credentials, trimmed])
      return { ...prev, credentials: next }
    })
    setCredentialDraft('')
  }

  function removeCredential(value: string) {
    setListing((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        credentials: prev.credentials.filter((c) => c !== value),
      }
    })
  }

  function addLicensedState(code: string) {
    if (!code) return
    toggleState(code)
    setStateDraft('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!listing) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        ...listing,
        specializations: normalizeAttorneySpecializations(listing.specializations),
        states_licensed: normalizeLicensedStates(listing.states_licensed),
        credentials: normalizeAttorneyCredentials(listing.credentials),
        fee_structure: normalizeAttorneyFeeStructure(listing.fee_structure),
        bar_number: listing.bar_number?.trim() || null,
      }
      const res = await fetch('/api/attorney/listing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setListing(toListingState(data.listing as Listing))
      setMessage('Saved.')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const feeValue = normalizeAttorneyFeeStructure(listing.fee_structure) ?? ''
  const availableStates = US_STATES.filter(({ code }) => !listing.states_licensed.includes(code))

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Firm settings</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Update your public directory profile. Client estate data remains owned by the household —
          this only affects how you appear to consumers.
        </p>
      </div>

      {!practiceComplete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Practice profile incomplete for paid client connections</p>
          <p className="mt-1 text-amber-800">
            Your first client is always free. Before a second client (or any client on their own
            paid subscription), complete:{' '}
            {practiceMissing
              .map((f) => {
                if (f === 'states_licensed') return 'licensed states'
                if (f === 'specializations') return 'practice areas'
                if (f === 'credentials') return 'credentials'
                return 'fee structure'
              })
              .join(', ')}
            .
          </p>
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-8">
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-neutral-800">Firm & contact</h2>
          <Field label="Firm name">
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={listing.firm_name ?? ''}
              onChange={(e) => setListing({ ...listing, firm_name: e.target.value })}
            />
          </Field>
          <Field label="Contact name">
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={listing.contact_name ?? ''}
              onChange={(e) => setListing({ ...listing, contact_name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                value={listing.city ?? ''}
                onChange={(e) => setListing({ ...listing, city: e.target.value })}
              />
            </Field>
            <Field label="State">
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                value={listing.state ?? ''}
                onChange={(e) => setListing({ ...listing, state: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Phone">
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={listing.phone ?? ''}
              onChange={(e) => setListing({ ...listing, phone: e.target.value })}
            />
          </Field>
          <Field label="Website">
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={listing.website ?? ''}
              onChange={(e) => setListing({ ...listing, website: e.target.value })}
            />
          </Field>
          <Field label="Bio">
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm resize-none"
              value={listing.bio ?? ''}
              onChange={(e) => setListing({ ...listing, bio: e.target.value })}
            />
          </Field>
          <p className="text-xs text-neutral-400">Directory email: {listing.email}</p>
        </section>

        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-800">Credentials and practice</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Shown to prospective clients as a credibility signal. All fields are optional to
                save — required before your second billable client or any client on their own paid
                subscription.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              {practiceAddedCount} of {ATTORNEY_PRACTICE_PROFILE_FIELD_COUNT} added
            </span>
          </div>

          <Field label="Bar number">
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              placeholder="WSBA #12345"
              value={listing.bar_number ?? ''}
              onChange={(e) => setListing({ ...listing, bar_number: e.target.value })}
            />
            {!listing.bar_number?.trim() && (
              <p className="mt-1 text-xs text-neutral-400">Not yet added.</p>
            )}
          </Field>

          <Field label="States licensed">
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {listing.states_licensed.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 ring-1 ring-blue-100"
                >
                  {code}
                  <button
                    type="button"
                    onClick={() => toggleState(code)}
                    className="text-blue-500 hover:text-blue-800"
                    aria-label={`Remove ${code}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {availableStates.length > 0 && (
                <div className="flex items-center gap-1">
                  <select
                    value={stateDraft}
                    onChange={(e) => {
                      const code = e.target.value
                      if (code) addLicensedState(code)
                    }}
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-xs bg-white"
                    aria-label="Add licensed state"
                  >
                    <option value="">+ Add state</option>
                    {availableStates.map(({ code, name }) => (
                      <option key={code} value={code}>
                        {code} — {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Field>

          <Field label="Practice areas">
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ATTORNEY_PRACTICE_AREAS.map(({ slug, label }) => (
                <label key={slug} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={listing.specializations.includes(slug)}
                    onChange={() => togglePracticeArea(slug)}
                    className="rounded border-neutral-300"
                  />
                  {label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Credentials">
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {listing.credentials.map((cred) => (
                <span
                  key={cred}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 ring-1 ring-sky-100"
                >
                  {cred}
                  <button
                    type="button"
                    onClick={() => removeCredential(cred)}
                    className="text-sky-500 hover:text-sky-800"
                    aria-label={`Remove ${cred}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {!showCredentialAdd ? (
                <button
                  type="button"
                  onClick={() => setShowCredentialAdd(true)}
                  className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  + Add credential
                </button>
              ) : (
                <div className="flex w-full min-w-[200px] flex-1 gap-2">
                  <input
                    list="attorney-credential-suggestions"
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="e.g. JD, ACTEC, LL.M."
                    value={credentialDraft}
                    onChange={(e) => setCredentialDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCredential(credentialDraft)
                        setShowCredentialAdd(false)
                      }
                      if (e.key === 'Escape') {
                        setShowCredentialAdd(false)
                        setCredentialDraft('')
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addCredential(credentialDraft)
                      setShowCredentialAdd(false)
                    }}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Pulled from your listing research — edit or add more.
            </p>
            <datalist id="attorney-credential-suggestions">
              {ATTORNEY_CREDENTIAL_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          <Field label="Fee structure">
            <select
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
              value={feeValue}
              onChange={(e) =>
                setListing({
                  ...listing,
                  fee_structure: e.target.value || null,
                })
              }
            >
              <option value="">Not specified</option>
              {ATTORNEY_FEE_STRUCTURE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </section>

        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {practiceComplete && (
        <p className="text-xs text-neutral-500">
          Practice profile complete — you can connect paid clients.{' '}
          <Link href="/attorney/requests" className="underline">
            View requests
          </Link>
        </p>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
