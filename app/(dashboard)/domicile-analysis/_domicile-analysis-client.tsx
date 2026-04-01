'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import DomicileChecklist from './_domicile-checklist'
import DomicileForm, { type DomicileFormPayload } from './_domicile-form'
import DomicileResults from './_domicile-results'
import type {
  DomicileAnalysisRow,
  DomicileChecklistRow,
  StateEstateTaxRule,
  StateInheritanceTaxRule,
  StateIncomeTaxRate,
} from './types'

export type { DomicileAnalysisRow, DomicileChecklistRow } from './types'

const inputClass =
  'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900'

const MAX_STATE_ROWS = 20

type ClientOption = { id: string; full_name: string; email: string }

function sortChecklist(items: DomicileChecklistRow[]) {
  const rank = (p: string) => (p === 'high' ? 0 : 1)
  return [...items].sort((a, b) => {
    const pr = rank(a.priority) - rank(b.priority)
    if (pr !== 0) return pr
    return a.category.localeCompare(b.category)
  })
}

export default function DomicileAnalysisClient({
  initialAnalysis,
  initialChecklist,
  role,
  clients,
  userId,
  stateEstateTaxRules,
  stateInheritanceTaxRules,
  stateIncomeTaxRates,
}: {
  initialAnalysis: DomicileAnalysisRow | null
  initialChecklist: DomicileChecklistRow[]
  role: string
  clients: ClientOption[]
  userId: string
  stateEstateTaxRules: StateEstateTaxRule[]
  stateInheritanceTaxRules: StateInheritanceTaxRule[]
  stateIncomeTaxRates: StateIncomeTaxRate[]
}) {
  const isAdvisor = role === 'advisor'
  const [subjectId, setSubjectId] = useState(userId)
  const [analysis, setAnalysis] = useState<DomicileAnalysisRow | null>(
    initialAnalysis
  )
  const [checklist, setChecklist] = useState<DomicileChecklistRow[]>(() =>
    sortChecklist(initialChecklist)
  )
  const [loadingSubject, setLoadingSubject] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const skipAdvisorHydrateFetch = useRef(isAdvisor)

  const loadForSubject = useCallback(
    async (targetId: string) => {
      setLoadingSubject(true)
      setError(null)
      try {
        const q =
          targetId === userId ? '' : `?client_id=${encodeURIComponent(targetId)}`
        const res = await fetch(`/api/domicile-analysis${q}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? res.statusText)
        }
        const { analysis: next } = (await res.json()) as {
          analysis: DomicileAnalysisRow | null
        }
        setAnalysis(next)
        if (next?.id) {
          const cr = await fetch(`/api/domicile-analysis/${next.id}/checklist`)
          if (!cr.ok) {
            const j = await cr.json().catch(() => ({}))
            throw new Error(j.error ?? cr.statusText)
          }
          const { items } = (await cr.json()) as { items: DomicileChecklistRow[] }
          setChecklist(sortChecklist(items ?? []))
        } else {
          setChecklist([])
        }

      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoadingSubject(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    if (!isAdvisor) return
    if (skipAdvisorHydrateFetch.current) {
      skipAdvisorHydrateFetch.current = false
      return
    }
    void loadForSubject(subjectId)
  }, [isAdvisor, subjectId, loadForSubject])

  async function handleDomicileSubmit(data: DomicileFormPayload) {
    setError(null)
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        user_id: subjectId,
        claimed_domicile_state: data.claimed_domicile_state,
        states: data.states,
        drivers_license_state: data.drivers_license_state,
        voter_registration_state: data.voter_registration_state,
        vehicle_registration_state: data.vehicle_registration_state,
        primary_home_titled_state: data.primary_home_titled_state,
        spouse_children_state: data.spouse_children_state,
        estate_docs_declare_state: data.estate_docs_declare_state,
        business_interests_state: data.business_interests_state,
        files_taxes_in_state: data.files_taxes_in_state,
      }
      const res = await fetch('/api/domicile-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? res.statusText)
      const next = json.analysis as DomicileAnalysisRow
      setAnalysis(next)
      if (next?.id) {
        const cr = await fetch(`/api/domicile-analysis/${next.id}/checklist`)
        if (cr.ok) {
          const { items } = (await cr.json()) as { items: DomicileChecklistRow[] }
          setChecklist(sortChecklist(items ?? []))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleChecklistItem(itemId: string, completed: boolean) {
    if (!analysis?.id) return
    const item = checklist.find((x) => x.id === itemId)
    if (!item) return
    setChecklist((prev) =>
      prev.map((x) =>
        x.id === itemId
          ? {
              ...x,
              completed,
              completed_at: completed ? new Date().toISOString() : null,
            }
          : x
      )
    )
    try {
      const res = await fetch(`/api/domicile-analysis/${analysis.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, completed }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? res.statusText)
      }
    } catch {
      setChecklist((prev) =>
        prev.map((x) =>
          x.id === itemId
            ? {
                ...x,
                completed: item.completed,
                completed_at: item.completed_at,
              }
            : x
        )
      )
    }
  }

  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold text-neutral-900">
        Multi-State Domicile Analysis
      </h1>
      <p className="mb-8 text-sm text-neutral-500">
        Compare ties across states against your claimed domicile and get a
        practical checklist. This is educational only and not legal advice.
      </p>

      {isAdvisor && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label
            htmlFor="subject"
            className="mb-1 block text-xs font-medium text-neutral-600"
          >
            Analysis for
          </label>
          <select
            id="subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={inputClass}
            disabled={loadingSubject}
          >
            <option value={userId}>Yourself</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || c.email || c.id}
              </option>
            ))}
          </select>
          {loadingSubject && (
            <p className="mt-2 text-xs text-neutral-400">Loading…</p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {analysis && (
        <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Results
          </h2>
          <DomicileResults
            analysis={analysis}
            onRerun={() => scrollToId('domicile-facts')}
            onViewChecklist={() => scrollToId('domicile-checklist')}
            stateEstateTaxRules={stateEstateTaxRules}
            stateInheritanceTaxRules={stateInheritanceTaxRules}
            stateIncomeTaxRates={stateIncomeTaxRates}
          />
        </section>
      )}

      <div id="domicile-facts" className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Your facts
        </h2>
        <DomicileForm
          key={`${subjectId}-${analysis?.id ?? 'none'}`}
          existingAnalysis={analysis}
          loading={submitting}
          maxStates={MAX_STATE_ROWS}
          onSubmit={(payload) => void handleDomicileSubmit(payload)}
        />
      </div>

      {analysis && (
        <section
          id="domicile-checklist"
          className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Checklist
          </h2>
          <DomicileChecklist
            items={checklist}
            onToggle={(itemId, completed) => void toggleChecklistItem(itemId, completed)}
          />
        </section>
      )}
    </div>
  )
}
