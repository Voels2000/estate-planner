'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Advisor = {
  id: string
  firm_name: string
  contact_name: string | null
  email: string
  website: string | null
  city: string | null
  state: string | null
  bio: string | null
  credentials: string[]
  specializations: string[]
  fee_structure: string | null
  minimum_assets: number | null
  is_fiduciary: boolean
  serves_remote: boolean
  languages: string[]
  is_verified: boolean
}

type Props = {
  advisors: Advisor[]
  allSpecializations: string[]
  allCredentials: string[]
  allStates: string[]
}

export function AdvisorDirectoryClient({
  advisors,
  allSpecializations,
  allCredentials,
  allStates,
}: Props) {
  const [search, setSearch] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [selectedSpec, setSelectedSpec] = useState('')
  const [selectedCred, setSelectedCred] = useState('')
  const [fiduciaryOnly, setFiduciaryOnly] = useState(false)
  const [remoteOnly, setRemoteOnly] = useState(false)

  const filtered = useMemo(() => {
    return advisors.filter(a => {
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
      if (selectedSpec && !a.specializations.includes(selectedSpec)) return false
      if (selectedCred && !a.credentials.includes(selectedCred)) return false
      if (fiduciaryOnly && !a.is_fiduciary) return false
      if (remoteOnly && !a.serves_remote) return false
      return true
    })
  }, [advisors, search, selectedState, selectedSpec, selectedCred, fiduciaryOnly, remoteOnly])

  function clearFilters() {
    setSearch('')
    setSelectedState('')
    setSelectedSpec('')
    setSelectedCred('')
    setFiduciaryOnly(false)
    setRemoteOnly(false)
  }

  const hasFilters = search || selectedState || selectedSpec || selectedCred || fiduciaryOnly || remoteOnly

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Find a Financial Advisor</h1>
        <p className="mt-2 text-neutral-600">
          Browse our network of vetted financial professionals specializing in estate and retirement planning.
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
          <select
            value={selectedCred}
            onChange={e => setSelectedCred(e.target.value)}
            className="rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="">All Credentials</option>
            {allCredentials.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={fiduciaryOnly}
              onChange={e => setFiduciaryOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Fiduciary only
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={e => setRemoteOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Serves remote clients
          </label>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        {filtered.length} {filtered.length === 1 ? 'advisor' : 'advisors'} found
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-neutral-200 p-12 text-center">
          <p className="text-neutral-500">No advisors match your filters.</p>
          <button onClick={clearFilters} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(advisor => (
            <Link
              key={advisor.id}
              href={`/advisor-directory/${advisor.id}`}
              className="block rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 hover:shadow-md hover:border-neutral-300 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-neutral-900">{advisor.firm_name}</h2>
                    {advisor.is_verified && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Verified
                      </span>
                    )}
                    {advisor.is_fiduciary && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Fiduciary
                      </span>
                    )}
                    {advisor.serves_remote && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        Remote
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    {[advisor.city, advisor.state].filter(Boolean).join(', ')}
                    {advisor.contact_name ? ' · ' + advisor.contact_name : ''}
                  </p>
                  {advisor.bio && (
                    <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{advisor.bio}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {advisor.credentials.map(c => (
                      <span key={c} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                        {c}
                      </span>
                   ))}
                    {advisor.specializations.map(s => (
                      <span key={s} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {advisor.fee_structure && (
                    <p className="text-sm font-medium text-neutral-900">{advisor.fee_structure}</p>
                  )}
                  {advisor.minimum_assets && (
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(advisor.minimum_assets)} min.
                    </p>
                  )}
                  <span className="mt-3 inline-block text-sm text-indigo-600 font-medium">
                    View profile
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
