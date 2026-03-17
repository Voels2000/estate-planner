'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type ExpenseType = { value: string; label: string }
type Expense = {
  id: string
  owner_id: string
  tsowner: string
  owner?: string
  category: string
  amount: number
  start_year: number
  end_year: number | null
  inflation_adjust: boolean
  created_at: string
  updated_at: string
}

export default function ExpensesPage() {
  const [person1Name, setPerson1Name] = useState('Person 1')
  const [person2Name, setPerson2Name] = useState('Person 2')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalAnnual = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: expenseData, error: expenseError }, { data: typesData }, { data: household }] = await Promise.all([
      supabase.from('expenses').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('expense_types').select('value, label').order('sort_order'),
      supabase.from('households').select('person1_name, person2_name, has_spouse').eq('owner_id', user.id).single(),
    ])

    if (expenseError) setError(expenseError.message)
    else setExpenses(expenseData ?? [])
    setExpenseTypes(typesData ?? [])
    if (household?.person1_name) setPerson1Name(household.person1_name)
    if (household?.person2_name) setPerson2Name(household.person2_name)
    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) setError(error.message)
    else setExpenses((prev) => prev.filter((e) => e.id !== id))
    setConfirmDeleteId(null)
  }

  function getTypeLabel(category: string) {
    return expenseTypes.find((t) => t.value === category)?.label ?? category
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Expenses</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Total annual: <span className="font-semibold text-neutral-900">{formatDollars(totalAnnual)}</span>
          </p>
        </div>
        <button
          onClick={() => { setEditExpense(null); setShowModal(true) }}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
        >
          + Add Expense
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">💸</div>
          <p className="text-sm font-medium text-neutral-600">No expenses yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add your first expense to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-100">
            <thead className="bg-neutral-50">
              <tr>
                {['Category', 'Owner', 'Annual Amount', 'Years', 'Inflation Adj.', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="group hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{getTypeLabel(expense.category)}</td>
                  <td className="px-4 py-3 text-sm text-neutral-500">
                    {(expense.owner ?? 'person1') === 'person1' ? person1Name : (expense.owner ?? 'person1') === 'person2' ? person2Name : 'Joint'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-neutral-900">{formatDollars(Number(expense.amount))}</td>
                  <td className="px-4 py-3 text-sm text-neutral-500">
                    {expense.start_year} — {expense.end_year ?? 'ongoing'}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500">
                    {expense.inflation_adjust ? '✓' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {confirmDeleteId === expense.id ? (
                      <span className="inline-flex items-center gap-2 text-sm">
                        <span className="text-neutral-500">Delete?</span>
                        <button onClick={() => handleDelete(expense.id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-neutral-400 hover:text-neutral-600">No</button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditExpense(expense); setShowModal(true) }} className="text-sm text-indigo-600 font-medium hover:text-indigo-800">Edit</button>
                        <button onClick={() => setConfirmDeleteId(expense.id)} className="text-sm text-red-500 font-medium hover:text-red-700">Delete</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ExpenseModal
          editExpense={editExpense}
          expenseTypes={expenseTypes}
          person1Name={person1Name}
          person2Name={person2Name}
          onClose={() => { setShowModal(false); setEditExpense(null) }}
          onSave={() => { setShowModal(false); setEditExpense(null); loadData() }}
        />
      )}
    </div>
  )
}

function ExpenseModal({ editExpense, expenseTypes, person1Name, person2Name, onClose, onSave }: {
  editExpense: Expense | null
  expenseTypes: ExpenseType[]
  person1Name: string
  person2Name: string
  onClose: () => void
  onSave: () => void
}) {
  const currentYear = new Date().getFullYear()
  const [owner, setOwner] = useState(editExpense?.owner ?? 'person1')
  const [category, setCategory] = useState(editExpense?.category ?? expenseTypes[0]?.value ?? '')
  const [amount, setAmount] = useState(editExpense?.amount?.toString() ?? '')
  const [startYear, setStartYear] = useState(editExpense?.start_year?.toString() ?? currentYear.toString())
  const [endYear, setEndYear] = useState(editExpense?.end_year?.toString() ?? '')
  const [inflationAdjust, setInflationAdjust] = useState(editExpense?.inflation_adjust ?? true)
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
        category,
        amount: parseFloat(amount),
        start_year: parseInt(startYear),
        end_year: endYear ? parseInt(endYear) : null,
        inflation_adjust: inflationAdjust,
        updated_at: new Date().toISOString(),
      }

      if (editExpense) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editExpense.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('expenses').insert({ ...payload, owner_id: user.id })
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
          <h2 className="text-base font-semibold text-neutral-900">{editExpense ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Expense Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {expenseTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
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
            <label className="block text-sm font-medium text-neutral-700 mb-1">Annual Amount ($)</label>
            <input type="number" min="0" step="0.01" required value={amount}
              onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Start Year</label>
              <input type="number" min="1900" max="2100" required value={startYear}
                onChange={(e) => setStartYear(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">End Year (optional)</label>
              <input type="number" min="1900" max="2100" value={endYear}
                onChange={(e) => setEndYear(e.target.value)} className={inputClass} placeholder="Ongoing" />
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
              {isSubmitting ? 'Saving...' : editExpense ? 'Save Changes' : 'Add Expense'}
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
