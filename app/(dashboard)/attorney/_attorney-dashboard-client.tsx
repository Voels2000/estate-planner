'use client'

import Link from 'next/link'
import { useState } from 'react'

type ClientCard = {
  connection_id: string
  household_id: string
  granted_at: string | null
  advisor_pdf_access: boolean
  full_name: string
  email: string
  household_name: string
  state: string
  complexity_flag: string
  doc_count: number
}

type Props = {
  attorneyName: string
  clients: ClientCard[]
}

const complexityColor: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export function AttorneyDashboardClient({ attorneyName, clients }: Props) {
  const [search, setSearch] = useState('')

  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.state.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Attorney Portal
        </h1>
        <p className="text-neutral-500 mt-1">
          Welcome back, {attorneyName}. You have access to {clients.length} client
          {clients.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Search */}
      {clients.length > 0 && (
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by name, email, or state..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      )}

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-neutral-200">
          <span className="mx-auto text-4xl mb-3 block text-center">👤</span>
          <p className="text-neutral-500 font-medium">No clients yet</p>
          <p className="text-neutral-400 text-sm mt-1">
            Clients will appear here once they grant you access to their estate plan.
          </p>
        </div>
      )}

      {/* No search results */}
      {clients.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
          <p className="text-neutral-500">No clients match your search.</p>
        </div>
      )}

      {/* Client cards */}
      <div className="space-y-3">
        {filtered.map(client => (
          <Link
            key={client.connection_id}
            href={`/attorney/clients/${client.household_id}`}
            className="block bg-white border border-neutral-200 rounded-xl p-5
                       hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              {/* Left - client info */}
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center
                                justify-center text-blue-600 font-semibold text-sm shrink-0">
                  {client.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-neutral-900">{client.full_name}</p>
                  <p className="text-sm text-neutral-400">{client.email}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {client.state && (
                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                        <span className="text-xs">📍</span>
                        {client.state}
                      </span>
                    )}
                    {client.complexity_flag && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${complexityColor[client.complexity_flag] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {client.complexity_flag} complexity
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <span className="text-xs">📄</span>
                      {client.doc_count} document{client.doc_count !== 1 ? 's' : ''}
                    </span>
                    {client.granted_at && (
                      <span className="text-xs text-neutral-400">
                        Access granted {new Date(client.granted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right - chevron */}
              <span className="text-neutral-300 group-hover:text-blue-400 transition-colors shrink-0">›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
