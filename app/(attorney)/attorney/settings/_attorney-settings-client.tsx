'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { US_STATES } from '@/lib/learn/us-states'
import {
  attorneyPracticeProfileCompletedCount,
  attorneyPracticeProfileMissingFields,
  isAttorneyPracticeProfileComplete,
  practiceProfileIncompleteBannerMessage,
  type PracticeProfileMissingField,
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

function licensedStateName(code: string): string {
  return US_STATES.find((s) => s.code === code)?.name ?? code
}

export function AttorneySettingsClient({ initialListing }: { initialListing: Listing | null }) {
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(
    initialListing ? toListingState(initialListing) : null,
  )
  const [credentialDraft, setCredentialDraft] = useState('')
  const [showCredentialAdd, setShowCredentialAdd] = useState(false)
  const [showStatePicker, setShowStatePicker] = useState(false)
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
  const practiceProgressPct = Math.round(
    (practiceAddedCount / ATTORNEY_PRACTICE_PROFILE_FIELD_COUNT) * 100,
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
    setShowCredentialAdd(false)
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
    setShowStatePicker(false)
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

  const fieldComplete = {
    states_licensed: listing.states_licensed.length > 0,
    specializations: listing.specializations.length > 0,
    credentials: listing.credentials.length > 0,
    fee_structure: Boolean(feeValue),
  }

  function gatedFieldStatus(
    field: PracticeProfileMissingField,
  ): 'complete' | 'incomplete' | undefined {
    if (fieldComplete[field]) return 'complete'
    if (practiceMissing.includes(field)) return 'incomplete'
    return undefined
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Firm settings</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Update your public directory profile. Client estate data remains owned by the household.
        </p>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Firm and contact</h2>
            <p className="mt-1 text-xs text-neutral-500">How you appear to consumers.</p>
          </div>

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

          <div className="border-t border-neutral-200 pt-6" />

          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Credentials and practice</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Shown to prospective clients as a credibility signal.
            </p>
          </div>

          {!practiceComplete && (
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-amber-900">
                  {practiceAddedCount} of {ATTORNEY_PRACTICE_PROFILE_FIELD_COUNT} complete
                </p>
                <span className="text-xs text-amber-800">{practiceProgressPct}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${practiceProgressPct}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                {practiceProfileIncompleteBannerMessage(practiceMissing)}
              </p>
            </div>
          )}

          <Field
            label="Bar number"
            status={listing.bar_number?.trim() ? 'complete' : undefined}
          >
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              placeholder="WSBA #12345"
              value={listing.bar_number ?? ''}
              onChange={(e) => setListing({ ...listing, bar_number: e.target.value })}
            />
          </Field>

          <Field label="States licensed" status={gatedFieldStatus('states_licensed')}>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {listing.states_licensed.map((code) => (
                <Chip
                  key={code}
                  label={licensedStateName(code)}
                  onRemove={() => toggleState(code)}
                />
              ))}
              {availableStates.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStatePicker((open) => !open)}
                    className="h-8 rounded-lg border border-neutral-300 px-3 text-sm text-neutral-800 hover:bg-neutral-50"
                  >
                    + Add state
                  </button>
                  {showStatePicker && (
                    <div className="absolute left-0 z-20 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                      {availableStates.map(({ code, name }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => addLicensedState(code)}
                          className="block w-full px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Field>

          <Field label="Practice areas" status={gatedFieldStatus('specializations')}>
            <div className="mt-2 flex flex-wrap gap-2">
              {ATTORNEY_PRACTICE_AREAS.map(({ slug, label }) => (
                <TogglePill
                  key={slug}
                  label={label}
                  selected={listing.specializations.includes(slug)}
                  onClick={() => togglePracticeArea(slug)}
                />
              ))}
            </div>
          </Field>

          <Field label="Credentials" status={gatedFieldStatus('credentials')}>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {listing.credentials.map((cred) => (
                <Chip key={cred} label={cred} onRemove={() => removeCredential(cred)} />
              ))}
              {!showCredentialAdd ? (
                <button
                  type="button"
                  onClick={() => setShowCredentialAdd(true)}
                  className="h-8 rounded-lg border border-neutral-300 px-3 text-sm text-neutral-800 hover:bg-neutral-50"
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
                    onClick={() => addCredential(credentialDraft)}
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

          <Field label="Fee structure" status={gatedFieldStatus('fee_structure')}>
            <div className="mt-2 flex flex-wrap gap-2">
              {ATTORNEY_FEE_STRUCTURE_OPTIONS.map(({ value, label }) => (
                <TogglePill
                  key={value}
                  label={label}
                  selected={feeValue === value}
                  onClick={() =>
                    setListing({
                      ...listing,
                      fee_structure: feeValue === value ? null : value,
                    })
                  }
                />
              ))}
            </div>
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

type FieldStatus = 'complete' | 'incomplete'

function Field({
  label,
  status,
  children,
}: {
  label: string
  status?: FieldStatus
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="text-xs font-medium text-neutral-600">{label}</label>
        {status === 'complete' && (
          <span className="text-sm text-emerald-800" aria-label="Complete">
            ✓
          </span>
        )}
        {status === 'incomplete' && (
          <span className="text-sm text-amber-800" aria-label="Required for paid connections">
            ⚠
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e6f1fb] px-3 py-1 text-sm text-[#0c447c]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="text-[#0c447c]/60 hover:text-[#0c447c]"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  )
}

function TogglePill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
        selected
          ? 'bg-neutral-900 text-white'
          : 'border border-neutral-300 text-neutral-800 hover:bg-neutral-50'
      }`}
    >
      {label}
    </button>
  )
}
