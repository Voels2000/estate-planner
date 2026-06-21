'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Listing = {
  id: string
  firm_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  city: string | null
  state: string | null
  bio: string | null
  fee_structure: string | null
}

export function AttorneySettingsClient({ initialListing }: { initialListing: Listing | null }) {
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(initialListing)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!listing) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-sm text-neutral-600">
          No directory listing linked to your account yet.{' '}
          <a href="/attorney-directory/register" className="text-[color:var(--mwm-navy)] underline hover:text-[color:var(--mwm-navy-light)]">
            Register your practice
          </a>{' '}
          to appear in Find an Attorney.
        </p>
      </div>
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/attorney/listing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listing),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setListing(data.listing)
      setMessage('Saved.')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Firm settings</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Update your public directory profile. Client estate data remains owned by the household —
          this only affects how you appear to consumers.
        </p>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
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
        <Field label="Fee structure">
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            value={listing.fee_structure ?? ''}
            onChange={(e) => setListing({ ...listing, fee_structure: e.target.value })}
          />
        </Field>
        <p className="text-xs text-neutral-400">Directory email: {listing.email}</p>
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
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
