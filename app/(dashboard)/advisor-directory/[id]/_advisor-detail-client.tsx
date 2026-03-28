'use client'

import { useState } from 'react'
import Link from 'next/link'

type Advisor = {
  id: string
  firm_name: string
  contact_name: string | null
  email: string
  website: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  bio: string | null
  credentials: string[]
  specializations: string[]
  fee_structure: string | null
  minimum_assets: number | null
  is_fiduciary: boolean
  serves_remote: boolean
  languages: string[]
  adv_link: string | null
  is_verified: boolean
}

type Props = {
  advisor: Advisor
  userName: string
  userEmail: string
}

export function AdvisorDetailClient({ advisor, userName, userEmail }: Props) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')

  async function handleRequestIntroduction() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor-directory/introduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisorId: advisor.id,
          advisorEmail: advisor.email,
          advisorFirmName: advisor.firm_name,
          advisorContactName: advisor.contact_name,
          userName,
          userEmail,
          note,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setSending(false); return }
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Back */}
      <div className="mb-6">
        <Link href="/advisor-directory" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
          ← Back to Directory
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main info */}
        <div className="md:col-span-2 space-y-6">
          {/* Header */}
          <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-neutral-900">{advisor.firm_name}</h1>
                  {advisor.is_verified && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      ✓ Verified
                    </span>
                  )}
            </div>
                {advisor.contact_name && (
                  <p className="mt-1 text-neutral-600">{advisor.contact_name}</p>
                )}
                <p className="mt-1 text-sm text-neutral-500">
                  {[advisor.city, advisor.state].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {advisor.is_fiduciary && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">Fiduciary</span>
              )}
              {advisor.serves_remote && (
                <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">Serves Remote Clients</span>
              )}
              {advisor.credentials.map(c => (
                <span key={c} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{c}</span>
              ))}
            </div>

            {advisor.bio && (
              <p className="mt-4 text-neutral-600 leading-relaxed">{advisor.bio}</p>
            )}
          </div>

          {/* Specializations */}
          {advisor.specializations.length > 0 && (
            <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">Specializations</h2>
              <div className="flex flex-wrap gap-2">
                {advisor.specializations.map(s => (
                  <span key={s} className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">Details</h2>
            <dl className="space-y-3">
              {advisor.fee_structure && (
                <div className="flex justify-between text-sm">
                  <dt className="text-neutral-500">Fee Structure</dt>
                  <dd className="font-medium text-neutral-900">{advisor.fee_structure}</dd>
                </div>
              )}
              {advisor.minimum_assets && (
                <div className="flex justify-between text-sm">
                  <dt className="text-neutral-500">Minimum Assets</dt>
                  <dd className="font-medium text-neutral-900">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(advisor.minimum_assets)}
                  </dd>
                </div>
              )}
              {advisor.languages.length > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-neutral-500">Languages</dt>
                  <dd className="font-medium text-neutral-900">{advisor.languages.join(', ')}</dd>
                </div>
              )}
              {advisor.website && (
                <div className="flex justify-between text-sm">
                  <dt className="text-neutral-500">Website</dt>
                  <dd>
                    <a href={advisor.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                      {advisor.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
              {advisor.adv_link && (
                <div className="flex justify-between text-sm">
                  <dt className="text-neutral-500">SEC/FINRA Disclosure</dt>
                  <dd>
                    <a href={advisor.adv_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                      View ADV →
                    </a>
                </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Introduction card */}
        <div className="md:col-span-1">
          <div className="sticky top-6 rounded-2xl bg-neutral-900 p-6 text-white shadow-sm">
            <h2 className="text-lg font-semibold">Request Introduction</h2>
            <p className="mt-2 text-sm text-neutral-400">
              We'll send {advisor.contact_name ?? advisor.firm_name} an introduction email on your behalf.
            </p>

            {sent ? (
              <div className="mt-6 rounded-lg bg-green-500/20 border border-green-500/30 p-4 text-center">
                <p className="text-sm font-medium text-green-300">✓ Introduction sent!</p>
                <p className="mt-1 text-xs text-neutral-400">Check your email for a confirmation.</p>
              </div>
            ) : (
              <>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note (optional) — e.g. your situation, goals, or questions..."
                  rows={4}
                  className="mt-4 w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                />
                {error && (
                  <p className="mt-2 text-xs text-red-400">{error}</p>
                )}
                <button
                  onClick={handleRequestIntroduction}
                  disabled={sending}
                  className="mt-4 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending...' : 'Send Introduction'}
                </button>
                <p className="mt-3 text-xs text-neutral-500 text-center">
                  Your name a email will be shared with the advisor.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
