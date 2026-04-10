'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addIncome, updateIncome, deleteIncome } from './actions'

type IncomeRow = {
  id: string
  owner_id: string
  source: string
  name?: string | null
  ss_person?: string | null
  amount: number
  start_year: number | null
  end_year: number | null
  inflation_adjust: boolean
  created_at: string
  updated_at: string
}

type IncomeType = { value: string; label: string }

type Props = {
  income: IncomeRow[]
  ownerId: string
  person1Name: string
  person2Name: string
  hasSpouse: boolean
  incomeTypes: IncomeType[]
}

const STORAGE_KEY = 'ep_income_groups'

const inputClass = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"

function sourceLabel(value: string, types: IncomeType[]) {
  return types.find(s => s.value === value)?.label ?? value
}

function formatDollars(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

export function IncomeClient({ income, ownerId, person1Name, person2Name, hasSpouse, incomeTypes }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen]             = useState(false)
  const [editRow, setEditRow]                 = useState<IncomeRow | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError]                     = useState<string | null>(null)
  const [openGroups, setOpenGroups]           = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const totalAnnual = income.reduce((sum, i) => sum + Number(i.amount), 0)

  function getOwnerLabel(row: IncomeRow) {
    const p = row.ss_person ?? 'person1'
    if (p === 'person2') return person2Name
    if (p === 'joint')   return 'Joint'
    return person1Name
  }

  function getDisplayName(row: IncomeRow) {
    if (row.name && row.name.trim()) return row.name.trim()
    return sourceLabel(row.source, incomeTypes)
  }

  const grouped = income.reduce<Record<string, IncomeRow[]>>((acc, row) => {
    const key = row.source || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  const groupKeys = Object.keys(grouped).sort((a, b) => sourceLabel(a, incomeTypes).localeCompare(sourceLabel(b, incomeTypes)))

  groupKeys.forEach((key) => {
    grouped[key].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
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
    if (!hasSaved && income.length > 0) {
      const allOpen: Record<string, boolean> = {}
      groupKeys.forEach((k) => { allOpen[k] = true })
      setOpenGroups(allOpen)
    }
  }, [income.length])

  async function handleDelete(id: string) {
    try {
      await deleteIncome(id, ownerId)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
    setConfirmDeleteId(null)
  }

  function openAdd()               { setEditRow(null);  setModalOpen(true) }
  function openEdit(row: IncomeRow){ setEditRow(row);   setModalOpen(true) }
  function closeModal()            { setModalOpen(false); setEditRow(null) }
  function handleSuccess()         { closeModal(); router.refresh() }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Income</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Total annual: <span className="font-semibold text-neutral-900">{formatDollars(totalAnnual)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
        >
          + Add Income
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {income.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-sm font-medium text-neutral-600">No income entries yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add your first income source to get started</p>
        </div>
      ) : (
        <>
          {groupKeys.map((groupKey) => {
            const groupItems = grouped[groupKey]
            const groupLabel = sourceLabel(groupKey, incomeTypes)
            const groupTotal = groupItems.reduce((s, item) => s + Number(item.amount), 0)
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
                  <span className="text-sm font-semibold text-neutral-900">{formatDollars(groupTotal)}</span>
                </button>

                {isOpen && (
                  <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-neutral-100">
                      <tbody className="divide-y divide-neutral-100">
                        {groupItems.map((row) => (
                          <tr key={row.id} className="group hover:bg-neutral-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-neutral-900">{getDisplayName(row)}</td>
                            <td className="px-4 py-3 text-sm text-neutral-500">{sourceLabel(row.source, incomeTypes)}</td>
                            <td className="px-4 py-3 text-sm text-neutral-500">{getOwnerLabel(row)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-neutral-900">{formatDollars(Number(row.amount))}</td>
                            <td className="px-4 py-3 text-sm text-neutral-500">
                              {row.start_year ?? '—'} to {row.end_year ? row.end_year : 'Ongoing'}
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-500">{row.inflation_adjust ? '✓' : '—'}</td>
                            <td className="px-4 py-3 text-right">
                              {confirmDeleteId === row.id ? (
                                <span className="inline-flex items-center gap-2 text-sm">
                                  <span className="text-neutral-500">Delete?</span>
                                  <button onClick={() => handleDelete(row.id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="text-neutral-400 hover:text-neutral-600">No</button>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEdit(row)} className="text-sm text-indigo-600 font-medium hover:text-indigo-800">Edit</button>
                                  <button onClick={() => setConfirmDeleteId(row.id)} className="text-sm text-red-500 font-medium hover:text-red-700">Delete</button>
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

      {modalOpen && (
        <IncomeModal
          editRow={editRow}
          ownerId={ownerId}
          person1Name={person1Name}
          person2Name={person2Name}
          hasSpouse={hasSpouse}
          incomeTypes={incomeTypes}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}

function IncomeModal({ editRow, ownerId, person1Name, person2Name, hasSpouse, incomeTypes, onClose, onSuccess }: {
  editRow: IncomeRow | null
  ownerId: string
  person1Name: string
  person2Name: string
  hasSpouse: boolean
  incomeTypes: IncomeType[]
  onClose: () => void
  onSuccess: () => void
}) {
  const currentYear = new Date().getFullYear()
  const [ssPerson,        setSsPerson]        = useState(editRow?.ss_person ?? 'person1')
  const [source,          setSource]          = useState(editRow?.source ?? (incomeTypes[0]?.value ?? 'salary'))
  const [name,            setName]            = useState(editRow?.name ?? '')
  const [amount,          setAmount]          = useState(editRow?.amount?.toString() ?? '')
  const [startYear,       setStartYear]       = useState(editRow?.start_year != null ? editRow.start_year.toString() : currentYear.toString())
  const [endYear,         setEndYear]         = useState(editRow?.end_year != null ? editRow.end_year.toString() : '')
  const [inflationAdjust, setInflationAdjust] = useState(editRow?.inflation_adjust ?? true)
  const [isSubmitting,    setIsSubmitting]    = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const parsedStartYear = parseInt(startYear)
    if (!parsedStartYear || parsedStartYear < 1900 || parsedStartYear > 2100) {
      setError('Please enter a valid start year (1900-2100).')
      setIsSubmitting(false)
      return
    }
    const parsedEndYear = endYear ? parseInt(endYear) : null
    if (parsedEndYear !== null && parsedEndYear < parsedStartYear) {
      setError('End year must be after start year.')
      setIsSubmitting(false)
      return
    }

    try {
      const payload = {
        source,
        name: name.trim() || null,
        ss_person: ssPerson,
        amount: parseFloat(amount),
        start_year: parsedStartYear,
        end_year: parsedEndYear,
        inflation_adjust: inflationAdjust,
      }
      if (editRow) {
        await updateIncome(editRow.id, ownerId, payload)
      } else {
        await addIncome(ownerId, payload)
      }
      onSuccess()
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
          <h2 className="text-base font-semibold text-neutral-900">{editRow ? 'Edit Income' : 'Add Income'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">X</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Income Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
              {incomeTypes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Name / Description <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder={`e.g. ${incomeTypes.find(s => s.value === source)?.label ?? 'My Salary'}`} />
            <p className="mt-1 text-xs text-neutral-400">Give this entry a custom name to tell it apart from others of the same type.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Owner</label>
            <select value={ssPerson} onChange={(e) => setSsPerson(e.target.value)} className={inputClass}>
              <option value="person1">{person1Name}</option>
              {hasSpouse && <option value="person2">{person2Name}</option>}
              <option value="joint">Joint</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Annual Amount ($)</label>
            <input type="number" min="0" step="0.01" required value={amount}
              onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0.00" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Start Year</label>
              <input type="number" min="1900" max="2100" required value={startYear}
                onChange={(e) => setStartYear(e.target.value)} className={inputClass}
                placeholder={currentYear.toString()} />
              <p className="mt-1 text-xs text-neutral-400">Year income begins</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">End Year</label>
              <input type="number" min="1900" max="2100" value={endYear}
                onChange={(e) => setEndYear(e.target.value)} className={inputClass}
                placeholder="Ongoing" />
              <p className="mt-1 text-xs text-neutral-400">Leave blank if ongoing</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input id="inflationAdjust" type="checkbox" checked={inflationAdjust}
              onChange={(e) => setInflationAdjust(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300" />
            <label htmlFor="inflationAdjust" className="text-sm text-neutral-700">
              Adjust for inflation in projections
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
              {isSubmitting ? 'Saving...' : editRow ? 'Save Changes' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
