'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SPECIALIZATIONS = [
  'Estate Planning',
  'Probate',
  'Elder Law',
  'Trust Administration',
  'Business Succession',
  'Charitable Giving',
  'Tax Law',
  'Family Law',
]

const LANGUAGES = [
  'English',
  'Spanish',
  'Mandarin',
  'Cantonese',
  'French',
  'German',
  'Portuguese',
  'Korean',
  'Japanese',
  'Arabic',
  'Hindi',
  'Tagalog',
]

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

export default function AttorneyRegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    firm_name: '',
    contact_name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    bar_number: '',
    fee_structure: '',
    bio: '',
    website: '',
    serves_remote: false,
    specializations: [] as string[],
    states_licensed: [] as string[],
    languages: [] as string[],
  })

  function toggleItem(field: 'specializations' | 'states_licensed' | 'languages', value: string) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(x => x !== value)
        : [...prev[field], value],
    }))
  }

  function toggleAllStates() {
    setForm(prev => ({
      ...prev,
      states_licensed: prev.states_licensed.length === US_STATES.length ? [] : [...US_STATES],
    }))
  }

  async function handleSubmit() {
    setError(null)
    if (!form.firm_name || !form.email || !form.state) {
      setError('Firm name, email, and state are required.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/attorney-directory/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Failed to submit listing.')
        return
      }
      setSuccess(true)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-neutral-900">Listing Submitted</h1>
        <p className="mt-3 text-neutral-500">
          Your listing is pending admin review. You&apos;ll receive an email
          at <strong>{form.email}</strong> once it&apos;s approved.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mt-8 rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 transition"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          List Your Attorney Practice
        </h1>
        <p className="mt-2 text-neutral-500">
          Your listing will be reviewed by our team before going live in
          the attorney directory.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6 rounded-2xl bg-white border border-neutral-200 shadow-sm p-8">

        {/* Firm & Contact */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Firm Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.firm_name}
              onChange={e => setForm(p => ({ ...p, firm_name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Contact Name
            </label>
            <input
              type="text"
              value={form.contact_name}
              onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {/* City, State, Bar Number */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">City</label>
            <input
              type="text"
              value={form.city}
              onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              State <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              maxLength={2}
              placeholder="WA"
              value={form.state}
              onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Bar Number</label>
            <input
              type="text"
              value={form.bar_number}
              onChange={e => setForm(p => ({ ...p, bar_number: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {/* Fee Structure & Website */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Fee Structure</label>
            <select
              value={form.fee_structure}
              onChange={e => setForm(p => ({ ...p, fee_structure: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select…</option>
              <option value="Flat fee">Flat fee</option>
              <option value="Hourly">Hourly</option>
              <option value="Contingency">Contingency</option>
              <option value="Retainer">Retainer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Website</label>
            <input
              type="url"
              placeholder="https://"
              value={form.website}
              onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {/* Serves Remote */}
        <div className="flex items-center gap-3">
          <input
            id="serves_remote"
            type="checkbox"
            checked={form.serves_remote}
            onChange={e => setForm(p => ({ ...p, serves_remote: e.target.checked }))}
            className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-300"
          />
          <label htmlFor="serves_remote" className="text-sm font-medium text-neutral-700">
            Available for remote / virtual consultations
          </label>
        </div>

        {/* Specializations */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Specializations
          </label>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleItem('specializations', s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  form.specializations.includes(s)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Languages
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(l => (
              <button
                key={l}
                type="button"
                onClick={() => toggleItem('languages', l)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  form.languages.includes(l)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* States Licensed */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-neutral-700">
              States Licensed
            </label>
            <button
              type="button"
              onClick={toggleAllStates}
              className="text-xs text-indigo-600 hover:underline"
            >
              {form.states_licensed.length === US_STATES.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {US_STATES.map(s => (
              <label
                key={s}
                className={`flex items-center justify-center rounded-lg border px-1.5 py-1 text-xs font-medium cursor-pointer transition ${
                  form.states_licensed.includes(s)
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.states_licensed.includes(s)}
                  onChange={() => toggleItem('states_licensed', s)}
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Bio</label>
          <textarea
            rows={4}
            value={form.bio}
            onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
            placeholder="Brief description of your practice and experience…"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700 transition disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
