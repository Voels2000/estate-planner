'use client'

// ─────────────────────────────────────────
// Menu: Financial Planning > Liabilities
// Route: /liabilities
// ─────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { displayPersonFirstName } from '@/lib/display-person-name'

type LiabilityType = { value: string; label: string }
type Liability = {
  id: string
  owner_id: string
  tsowner: string
  owner?: string
  type: string
  name: string
  balance: number
  interest_rate: number | null
  monthly_payment: number | null
  created_at: string
  updated_at: string
}

const STORAGE_KEY = 'ep_liabilities_groups'

export default function LiabilitiesPage() {
  const [person1Name, setPerson1Name] = useState('Person 1')
  const [person2Name, setPerson2Name] = useState('Person 2')
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [liabilityTypes, setLiabilityTypes] = useState<LiabilityType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editLiability, setEditLiability] = useState<Liability | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [error, setError] = useState<string | null>(null)

  const totalBalance = liabilities.reduce((sum, l) => sum + Number(l.balance), 0)
  const totalMonthly = liabilities.reduce((sum, l) => sum + Number(l.monthly_payment ?? 0), 0)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: liabData, error: liabError }, { data: typesData }, { data: household }] = await Promise.all([
      supabase.from('liabilities').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('liability_types').select('value, label').order('sort_order'),
      supabase.from('households').select('person1_name, person2_name, has_spouse').eq('owner_id', user.id).single(),
    ])

    if (liabError) setError(liabError.message)
    else setLiabilities(liabData ?? [])
    setLiabilityTypes(typesData ?? [])
    if (household?.person1_name) setPerson1Name(displayPersonFirstName(household.person1_name, 'Person 1'))
    if (household?.person2_name) setPerson2Name(displayPersonFirstName(household.person2_name, 'Person 2'))
    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('liabilities').delete().eq('id', id)
    if (error) setError(error.message)
    else setLiabilities(prev => prev.filter(l => l.id !== id))
    setConfirmDeleteId(null)
  }

  function getTypeLabel(type: string) {
    return liabilityTypes.find(t => t.value === type)?.label ?? type
  }

  const grouped = liabilities.reduce<Record<string, Liability[]>>((acc, liability) => {
    const key = liability.type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(liability)
    return acc
  }, {})

  const groupKeys = Object.keys(grouped).sort((a, b) => getTypeLabel(a).localeCompare(getTypeLabel(b)))

  groupKeys.forEach((key) => {
    grouped[key].sort((a, b) => a.name.localeCompare(b.name))
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups))
    } catch {}
  }, [openGroups])

  useEffect(() => {
    const hasSaved = (() => {
      try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
    })()
    if (!hasSaved && liabilities.length > 0) {
      const allOpen: Record<string, boolean> = {}
      groupKeys.forEach((k) => { allOpen[k] = true })
      setOpenGroups(allOpen)
    }
  }, [liabilities.length])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Liabilities</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-neutral-600">
              Total balance: <span className="font-semibold text-red-600">{formatDollars(totalBalance)}</span>
            </p>
            {totalMonthly > 0 && (
              <p className="text-sm text-neutral-600">
                Monthly payments: <span className="font-semibold text-neutral-900">{formatDollars(totalMonthly)}</span>
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => { setEditLiability(null); setShowModal(true) }}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
        >
          + Add Liability
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {liabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">💳</div>
          <p className="text-sm font-medium text-neutral-600">No liabilities yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add mortgages, loans and other debts to complete your net worth</p>
        </div>
      ) : (
        <>
          {groupKeys.map((groupKey) => {
            const groupItems = grouped[groupKey]
            const groupLabel = getTypeLabel(groupKey)
            const groupTotal = groupItems.reduce((s, item) => s + Number(item.balance), 0)
            const isOpen = openGroups[groupKey] ?? true

            return (
              <div key={groupKey} className="mb-4">
                <button
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition mb-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <span className="text-sm font-semibold text-neutral-700">{groupLabel}</span>
                    <span className="text-xs text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded-full">
                      {groupItems.length}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{formatDollars(groupTotal)}</span>
                </button>

                {isOpen && (
                  <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-neutral-100">
                      <tbody className="divide-y divide-neutral-100">
                        {groupItems.map((liability) => (
                          <tr key={liability.id} className="group hover:bg-neutral-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-neutral-900">{liability.name}</td>
                            <td className="px-4 py-3 text-sm text-neutral-500">{getTypeLabel(liability.type)}</td>
                            <td className="px-4 py-3 text-sm text-neutral-500">
                              {(liability.owner ?? 'person1') === 'person1' ? person1Name : (liability.owner ?? 'person1') === 'person2' ? person2Name : 'Joint'}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-600">{formatDollars(Number(liability.balance))}</td>
                            <td className="px-4 py-3 text-sm text-neutral-500">
                              {liability.interest_rate ? `${liability.interest_rate}%` : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-500">
                              {liability.monthly_payment ? formatDollars(Number(liability.monthly_payment)) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {confirmDeleteId === liability.id ? (
                                <span className="inline-flex items-center gap-2 text-sm">
                                  <span className="text-neutral-500">Delete?</span>
                                  <button onClick={() => handleDelete(liability.id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="text-neutral-400 hover:text-neutral-600">No</button>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditLiability(liability); setShowModal(true) }} className="text-sm text-indigo-600 font-medium hover:text-indigo-800">Edit</button>
                                  <button onClick={() => setConfirmDeleteId(liability.id)} className="text-sm text-red-500 font-medium hover:text-red-700">Delete</button>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {showModal && (
        <LiabilityModal
          editLiability={editLiability}
          liabilityTypes={liabilityTypes}
          person1Name={person1Name}
          person2Name={person2Name}
          onClose={() => { setShowModal(false); setEditLiability(null) }}
          onSave={() => { setShowModal(false); setEditLiability(null); loadData() }}
        />
      )}
    </div>
  )
}

function LiabilityModal({ editLiability, liabilityTypes, person1Name, person2Name, onClose, onSave }: {
  editLiability: Liability | null
  liabilityTypes: LiabilityType[]
  person1Name: string
  person2Name: string
  onClose: () => void
  onSave: () => void
}) {
  const sortedLiabilityTypes = [...liabilityTypes].sort((a, b) => a.label.localeCompare(b.label))
  const [owner, setOwner] = useState(editLiability?.owner ?? 'person1')
  const [type, setType] = useState(editLiability?.type ?? sortedLiabilityTypes[0]?.value ?? '')
  const [name, setName] = useState(editLiability?.name ?? '')
  const [balance, setBalance] = useState(editLiability?.balance?.toString() ?? '')
  const [interestRate, setInterestRate] = useState(editLiability?.interest_rate?.toString() ?? '')
  const [monthlyPayment, setMonthlyPayment] = useState(editLiability?.monthly_payment?.toString() ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const payload = {
        owner,
        type,
        name,
        balance: parseFloat(balance),
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        monthly_payment: monthlyPayment ? parseFloat(monthlyPayment) : null,
        updated_at: new Date().toISOString(),
      }

      if (editLiability) {
        const { error } = await supabase.from('liabilities').update(payload).eq('id', editLiability.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('liabilities').insert({ ...payload, owner_id: user.id })
        if (error) throw error
      }
      onSave()
    } catch (err) {
     setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">{editLiability ? 'Edit Liability' : 'Add Liability'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Liability Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {sortedLiabilityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Owner</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
              <option value="person1">{person1Name}</option>
              <option value="person2">{person2Name}</option>
              <option value="joint">Joint</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className={inputClass} placeholder="e.g. Primary Mortgage, Car Loan" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Current Balance ($)</label>
            <input type="number" min="0" step="0.01" required value={balance}
              onChange={(e) => setBalance(e.target.value)} className={inputClass} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Interest Rate (%) <span className="text-neutral-400">optional</span></label>
              <input type="number" min="0" max="100" step="0.01" value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)} className={inputClass} placeholder="e.g. 6.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Monthly Payment ($) <span className="text-neutral-400">optional</span></label>
              <input type="number" min="0" step="0.01" value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
              {isSubmitting ? 'Saving...' : editLiability ? 'Save Changes' : 'Add Liability'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
