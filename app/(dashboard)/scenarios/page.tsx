'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Scenario = {
  id: string
  household_id: string
  scenario_name: string
  state_override: string | null
  calculated_at: string
  summary: {
    at_retirement: number
    peak: number
    final: number
    funds_outlast: boolean
  }
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadScenarios = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: household } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!household) { setIsLoading(false); return }

    const { data, error } = await supabase
      .from('projections')
      .select('*')
      .eq('household_id', household.id)
      .order('calculated_at', { ascending: false })

    if (error) setError(error.message)
    else setScenarios(data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => { loadScenarios() }, [loadScenarios])

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('projections').delete().eq('id', id)
    if (error) setError(error.message)
    else setScenarios((prev) => prev.filter((s) => s.id !== id))
    setConfirmDeleteId(null)
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Scenarios</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Compare saved projection scenarios
          </p>
        </div>
        <a
          href="/projections"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
        >
          + New Scenario
        </a>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {scenarios.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">🔮</div>
          <p className="text-sm font-medium text-neutral-600">No saved scenarios yet</p>
          <p className="text-xs text-neutral-400 mt-1">Go to Projections and save a scenario to compare here</p>
          <a href="/projections" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Projections →</a>
        </div>
      ) : (
        <div className="grid gap-4">
          {scenarios.map((scenario) => (
            <div key={scenario.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">{scenario.scenario_name}</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Saved {new Date(scenario.calculated_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {confirmDeleteId === scenario.id ? (
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span className="text-neutral-500">Delete?</span>
                      <button onClick={() => handleDelete(scenario.id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-neutral-400 hover:text-neutral-600">No</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(scenario.id)}
                      className="text-sm text-red-500 font-medium hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {scenario.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <ScenarioStat label="At Retirement" value={formatDollars(scenario.summary.at_retirement)} />
                  <ScenarioStat label="Peak Portfolio" value={formatDollars(scenario.summary.peak)} />
                  <ScenarioStat label="Final Balance" value={formatDollars(scenario.summary.final)} />
                  <ScenarioStat
                    label="Funds Outlast"
                    value={scenario.summary.funds_outlast ? 'Yes ✓' : 'No ✗'}
                    highlight={scenario.summary.funds_outlast ? 'green' : 'red'}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScenarioStat({ label, value, highlight }: {
  label: string; value: string; highlight?: 'green' | 'red'
}) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-sm font-bold ${
        highlight === 'green' ? 'text-green-600' :
        highlight === 'red' ? 'text-red-600' :
        'text-neutral-900'
      }`}>{value}</p>
    </div>
  )
}

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}
