// components/advisor/DomicileScheduleEditor.tsx
// Sprint 65 - Domicile schedule editor + checklist in StrategyTab
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  seedDomicileChecklist,
  toggleChecklistItem as toggleChecklistItemAction,
} from '@/app/actions/domicile-actions'
import {
  getDomicileForYear,
  calculateMoveBreakeven,
  type DomicileScheduleRow,
  type MoveBreakevenResult,
} from '@/lib/projection/domicileEngine'
import { parseStateTaxCode } from '@/lib/projection/stateRegistry'
import MoveBreakevenPanel from './MoveBreakevenPanel'

const STATE_OPTIONS = [
  'AK','AL','AR','AZ','CA','CO','CT','DC','DE','FL','GA','HI','IA','ID',
  'IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC',
  'ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD',
  'TN','TX','UT','VA','VT','WA','WI','WV','WY',
]

type ChecklistDbRow = {
  id: string
  category?: string | null
  label?: string | null
  description?: string | null
  priority?: string | null
  completed?: boolean | null
  completed_at?: string | null
}

interface Props {
  householdId:       string
  currentState:        string
  grossEstateByYear:   Record<number, number>
  federalExemption?:   number
  initialSchedule:     DomicileScheduleRow[]
  initialChecklist:    ChecklistDbRow[]
}

export default function DomicileScheduleEditor({
  householdId,
  currentState,
  grossEstateByYear,
  federalExemption,
  initialSchedule,
  initialChecklist,
}: Props) {
  const router = useRouter()
  const [schedule, setSchedule]           = useState<DomicileScheduleRow[]>(initialSchedule ?? [])
  const [saving, setSaving]               = useState(false)
  const [breakeven, setBreakeven]         = useState<MoveBreakevenResult | null>(null)
  const [checklist, setChecklist]         = useState<ChecklistDbRow[]>(initialChecklist ?? [])
  const [activeTab, setActiveTab]         = useState<'schedule' | 'breakeven' | 'checklist'>('schedule')

  // New row form
  const [newYear, setNewYear]             = useState<number>(new Date().getFullYear() + 1)
  const [newState, setNewState]           = useState('')
  const [newEstablished, setNewEstablished] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    setChecklist(initialChecklist)
  }, [initialChecklist])

  async function addRow() {
    if (!newState) return
    setSaving(true)
    const { data } = await supabase
      .from('domicile_schedule')
      .upsert({
        household_id:   householdId,
        effective_year: newYear,
        state_code:     newState,
        is_established: newEstablished,
      }, { onConflict: 'household_id,effective_year' })
      .select()
    if (data?.length) {
      const inserted = data[0] as DomicileScheduleRow
      setSchedule(prev => {
        const withoutYear = prev.filter(r => r.effective_year !== inserted.effective_year)
        return [...withoutYear, inserted].sort((a, b) => a.effective_year - b.effective_year)
      })
    }
    setNewState('')
    setSaving(false)
  }

  async function toggleEstablished(row: DomicileScheduleRow) {
    const next = !row.is_established
    const { error } = await supabase
      .from('domicile_schedule')
      .update({ is_established: next })
      .eq('id', row.id!)
    if (error) return
    setSchedule(prev =>
      prev.map(r => (r.id === row.id ? { ...r, is_established: next } : r))
    )
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('domicile_schedule').delete().eq('id', id)
    if (error) return
    setSchedule(prev => prev.filter(r => r.id !== id))
  }

  async function toggleChecklistItem(itemId: string, completed: boolean) {
    const res = await toggleChecklistItemAction(itemId, completed)
    if (res.success) router.refresh()
  }

  function runBreakeven() {
    if (schedule.length < 2) return
    const transition = schedule.find(r => r.state_code !== currentState)
    if (!transition) return

    const result = calculateMoveBreakeven({
      grossEstateByYear,
      fromState:       parseStateTaxCode(currentState),
      toState:         parseStateTaxCode(transition.state_code),
      transitionYear:  transition.effective_year,
      federalExemption,
    })
    setBreakeven(result)
    setActiveTab('breakeven')
  }

  async function seedChecklist(toState: string) {
    const res = await seedDomicileChecklist(householdId, toState)
    console.log('seedChecklist result:', res, 'householdId:', householdId, 'toState:', toState)
    if (!res.success) return
    router.refresh()
    setActiveTab('checklist')
  }

  const tabs = [
    { id: 'schedule',   label: 'Schedule' },
    { id: 'breakeven',  label: 'Move Breakeven' },
    { id: 'checklist',  label: 'Establishment Checklist' },
  ] as const

  const completedCount = checklist.filter(i => i.completed).length
  const criticalIncomplete = checklist.filter(i => i.priority === 'critical' && !i.completed).length

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Domicile Schedule</h3>
        {schedule.length >= 2 && (
          <button
            onClick={runBreakeven}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            Run Breakeven Analysis
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.id === 'checklist' && checklist.length > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                criticalIncomplete > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {completedCount}/{checklist.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Schedule tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-3">
          {schedule.length === 0 ? (
            <p className="text-sm text-slate-400">No domicile schedule entries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Year</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">State</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Established</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Effective Domicile</th>
                  <th className="text-xs font-semibold text-slate-500 pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {schedule.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{row.effective_year}</td>
                    <td className="py-2.5 text-slate-700">{row.state_code}</td>
                    <td className="py-2.5">
                      <button
                        onClick={() => toggleEstablished(row)}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          row.is_established
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {row.is_established ? '✓ Established' : 'Pending'}
                      </button>
                    </td>
                    <td className="py-2.5 text-slate-500 text-xs">
                      {getDomicileForYear(schedule, row.effective_year)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => deleteRow(row.id!)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Add new row */}
          <div className="border-t pt-3 flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <input
                type="number"
                value={newYear}
                onChange={e => setNewYear(Number(e.target.value))}
                className="border border-slate-300 rounded px-2 py-1.5 text-sm w-24"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
              <select
                value={newState}
                onChange={e => setNewState(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">Select state</option>
                {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 mb-0.5">
              <input
                type="checkbox"
                id="established"
                checked={newEstablished}
                onChange={e => setNewEstablished(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="established" className="text-xs text-slate-600">Established</label>
            </div>
            <button
              onClick={addRow}
              disabled={!newState || saving}
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-0.5"
            >
              Add
            </button>
            {newState && newState !== currentState && (
              <button
                onClick={() => seedChecklist(newState)}
                className="text-sm text-blue-600 hover:underline mb-0.5"
              >
                + Seed {newState} checklist
              </button>
            )}
          </div>
        </div>
      )}

      {/* Breakeven tab */}
      {activeTab === 'breakeven' && (
        <MoveBreakevenPanel result={breakeven} />
      )}

      {/* Checklist tab */}
      {activeTab === 'checklist' && (
        <div className="space-y-3">
          {checklist.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400 mb-2">No checklist items yet.</p>
              <button
                onClick={() => {
                  console.log('SEED BUTTON CLICKED')
                  const found = schedule.find(r => r.state_code !== currentState)
                  console.log('found state:', found?.state_code)
                  if (found) seedChecklist(found.state_code)
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Seed establishment checklist
              </button>
            </div>
          ) : (
            <p className="text-xs text-red-500">DEBUG: checklist has {checklist.length} items</p>
          )}
          {checklist.length > 0 && (
            <>
              {criticalIncomplete > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-800">
                  {criticalIncomplete} critical item{criticalIncomplete !== 1 ? 's' : ''} not yet complete.
                </div>
              )}
              {Object.entries(
                checklist.reduce<Record<string, ChecklistDbRow[]>>((acc, item) => {
                  const cat = String(item.category ?? 'other')
                  acc[cat] = [...(acc[cat] ?? []), item]
                  return acc
                }, {})
              ).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 capitalize">
                    {category.replace(/_/g, ' ')}
                  </h4>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div
                        key={String(item.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          item.completed ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200'
                        }`}
                      >
                        <button
                          onClick={() => toggleChecklistItem(item.id, Boolean(item.completed))}
                          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                            item.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {Boolean(item.completed) && <span className="text-xs">✓</span>}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                              {item.label ?? ''}
                            </p>
                            {item.priority === 'critical' && !item.completed && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Critical</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{String(item.description ?? '')}</p>
                          {item.completed_at && (
                            <p className="text-xs text-emerald-600 mt-0.5">
                              Completed {new Date(String(item.completed_at)).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
