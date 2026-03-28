'use client'

import { useState } from 'react'

type Advisor = {
  id: string
  firm_name: string
  contact_name: string | null
  email: string
  city: string | null
  state: string | null
  fee_structure: string | null
  is_fiduciary: boolean
  is_verified: boolean
  is_active: boolean
  created_at: string
  specializations: string[]
  credentials: string[]
}

type Props = { advisors: Advisor[] }

export function AdminAdvisorDirectoryClient({ advisors: initial }: Props) {
  const [advisors, setAdvisors] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggleField(id: string, field: 'is_verified' | 'is_active', value: boolean) {
    setLoading(`${id}-${field}`)
    setError(null)
    try {
      const res = await fetch('/api/advisor-directory/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value }),
      })
      if (!res.ok) { setError('Update failed'); return }
      setAdvisors(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  async function deleteAdvisor(id: string) {
    if (!confirm('Are you sure you want to delete this listing?')) return
    setLoading(`${id}-delete`)
    setError(null)
    try {
      const res = await fetch('/api/advisor-directory/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { setError('Delete failed'); return }
      setAdvisors(prev => prev.filter(a => a.id !== id))
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Advisor Directory</h1>
          <p className="mt-1 text-neutral-500">{advisors.length} listings</p>
        </div>
        
          href="/advisor-directory"
          className="text-sm text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline"
        >
          View public directory &rarr;
        </a>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
        <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Firm</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Location</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Specializations</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Fiduciary</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Verified</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Active</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {advisors.map(advisor => (
              <tr key={advisor.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{advisor.firm_name}</p>
                  <p className="text-neutral-500">{advisor.email}</p>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {[advisor.city, advisor.state].filter(Boolean).join(', ')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {advisor.specializations.slice(0, 2).map(s => (
                      <span key={s} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{s}</span>
                    ))}
                    {advisor.specializations.length > 2 && (
                      <span className="text-xs text-neutral-400">+{advisor.specializations.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {advisor.is_fiduciary ? '✓' : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleField(advisor.id, 'is_verified', !advisor.is_verified)}
                    disabled={loading === `${advisor.id}-is_verified`}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      advisor.is_verified
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {advisor.is_verified ? 'Verified' : 'Unverified'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleField(advisor.id, 'is_active', !advisor.is_active)}
                    disabled={log === `${advisor.id}-is_active`}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      advisor.is_active
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {advisor.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => deleteAdvisor(advisor.id)}
                    disabled={loading === `${advisor.id}-delete`}
                    className="text-xs text-red-500 hover:text-red-700 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
