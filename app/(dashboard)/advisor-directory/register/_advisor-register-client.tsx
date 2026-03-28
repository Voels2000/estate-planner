'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SPECIALIZATION_OPTIONS = [
  'Estate Planning',
  'Retirement',
  'Tax Planning',
  'Investment Management',
  'Business Succession',
  'Charitable Giving',
  'Gifting',
  'Incapacity Planning',
  'Social Security',
  'Insurance',
]

const CREDENTIAL_OPTIONS = ['CFP', 'CPA', 'JD', 'CFA', 'ChFC', 'EA', 'RICP']
const FEE_OPTIONS = ['AUM', 'Flat Fee', 'Hourly', 'Retainer']

type Props = {
  userId: string
  userName: string
  userEmail: string
  existingId: string | null
}

export function AdvisorRegisterClient({ userId, userName, userEmail, existingId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    firm_name: '',
    contact_name: userName,
    email: userEmail,
    website: '',
    city: '',
    state: '',
    zip_code: '',
    bio: '',
    fee_structure: '',
    minimum_assets: '',
    is_fiduciary: false,
    serves_remote: false,
    adv_link: '',
    languages: 'English',
    credentials: [] as string[],
    specializations: [] as string[],
  })

  function toggleArray(field: 'credentials' | 'specializations', value: string) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }))
  }

  async function handleSubmit() {
    if (!form.firm_name || !form.email) {
      setError('Firm name and email are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor-directory/register', {
        method: existingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          minimum_assets: form.minimum_assets ? parseInt(form.minimum_assets) : null,
          languages: form.languages.split(',').map(l => l.trim()).filter(Boolean),
          submitted_by: userId,
          existingId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setSaving(false); return }
      router.push('/advisor-directory')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <a href="/advisor-directory" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
          ← Back to Directory
        </a>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          {existingId ? 'Update Your Listing' : 'List Your Firm'}
        </h1>
        <p className="mt-2 text-neutral-600">
          {existingId
            ? 'Update your firm's information in the advisor directory.'
            : 'Add your firm to the My Wealth Maps advisor directory. Listings are reviewed before going live.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Firm info */}
        <div className="rounded-2xl bg-white border border-ntral-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Firm Information</h2>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Firm Name *</label>
            <input
              type="text"
              value={form.firm_name}
              onChange={e => setForm(p => ({ ...p, firm_name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Contact Name</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Contact Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Website</label>
            <input
              type="url"
              value={form.website}
              onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
              placeholder="https://"
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
              rows={4}
              placeholder="Brief description of your firm, clients you serve, and your approach..."
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            />
          </div>
        </div>

        {/* Location */}
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">State</label>
              <input
                type="text"
                value={form.state}
                onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                placeholder="e.g. WA"
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Zip Code</label>
            <input
              type="text"
              value={form.zip_code}
              onChange={e => setForm(p => ({ ...p, zip_code: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.serves_remote}
              onChange={e => setForm(p => ({ ...p, serves_remote: e.target.checked }))}
              className="rounded border-neutral-300"
            />
            We serve remote / virtual clients
          </label>
        </div>

        {/* Practice details */}
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Practice Details</h2>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Fee Structure</label>
            <select
              value={form.fee_structure}
              onChange={e => setForm(p => ({ ...p, fee_structure: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="">Select fee structure</option>
              {FEE_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Minimum Assets (USD)</label>
            <input
              type="number"
              value={form.minimum_assets}
              onChange={e => setForm(p => ({ ...p, minimum_assets: e.target.value }))}
              placeholder="e.g. 500000 — leave blank if none"
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Languages (comma separated)</label>
            <input
              type="text"
              value={form.languages}
              onChange={e => setForm(p => ({ ...p, languages: e.target.value }))}
              placeholder="e.g. English, Spanish"
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block te-sm font-medium text-neutral-700 mb-1">SEC/FINRA ADV Link</label>
            <input
              type="url"
              value={form.adv_link}
              onChange={e => setForm(p => ({ ...p, adv_link: e.target.value }))}
              placeholder="https://adviserinfo.sec.gov/..."
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_fiduciary}
              onChange={e => setForm(p => ({ ...p, is_fiduciary: e.target.checked }))}
              className="rounded border-neutral-300"
            />
            We are a fiduciary
          </label>
        </div>

        {/* Credentials */}
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Credentials</h2>
          <div className="flex flex-wrap gap-2">
            {CREDENTIAL_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => toggleArray('credentials', c)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  form.credentials.includes(c)
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Specializations */}
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Specializations</h2>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATION_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => toggleArray('specializations', s)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  form.specializations.includes(s)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : existingId ? 'Update Listing' : 'Submit Listing for Review'}
        </button>
      </div>
    </div>
  )
}
