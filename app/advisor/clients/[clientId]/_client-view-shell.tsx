'use client'
// app/advisor/clients/[clientId]/_client-view-shell.tsx
// Tab shell — renders header + tab bar + active tab content

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import OverviewTab from './_tabs/OverviewTab'
import EstateTab from './_tabs/EstateTab'
import RetirementTab from './_tabs/RetirementTab'
import DocumentsTab from './_tabs/DocumentsTab'
import NotesTab from './_tabs/NotesTab'
import { getComplexityStyle, getAge, formatCurrency } from './_utils'

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: '◎' },
  { id: 'estate',      label: 'Estate',      icon: '⬡' },
  { id: 'retirement',  label: 'Retirement',  icon: '◷' },
  { id: 'documents',   label: 'Documents',   icon: '⊞' },
  { id: 'notes',       label: 'Notes',       icon: '✎', advisorOnly: true },
]

export default function ClientViewShell(props: ClientViewShellProps) {
  const { tab, household } = props
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setTab = useCallback((t: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  const { complexity, complexityColor, complexityBg } = getComplexityStyle(household.estate_complexity_flag)
  const currentYear = new Date().getFullYear()
  const p1Age = getAge(household.person1_birth_year, currentYear)
  const p2Age = household.has_spouse ? getAge(household.person2_birth_year, currentYear) : null

  const clientName = household.has_spouse
    ? `${household.person1_first_name} & ${household.person2_first_name} ${household.person1_last_name}`
    : `${household.person1_first_name} ${household.person1_last_name}`

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Back nav ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <a href="/advisor" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5 w-fit">
          <span>←</span> Back to Client List
        </a>
      </div>

      {/* ── Client header ── */}
      <div className="bg-white border-b border-slate-200 px-6 pt-6 pb-0">
        <div className="max-w-6xl mx-auto">

          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-semibold text-slate-900">{clientName}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${complexityBg} ${complexityColor}`}>
                  {complexity} Complexity
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>
                  {household.person1_first_name}, age {p1Age}
                  {p2Age !== null && ` · ${household.person2_first_name}, age ${p2Age}`}
                </span>
                <span>·</span>
                <span>{formatFilingStatus(household.filing_status)}</span>
                <span>·</span>
                <span>{household.state_primary}</span>
              </div>
            </div>

            {/* Complexity score badge */}
            <div className="text-right">
              <div className="text-3xl font-bold text-slate-800">{household.estate_complexity_score ?? '—'}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Complexity Score</div>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex gap-1 -mb-px">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                  ${tab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }
                  ${t.advisorOnly ? 'ml-auto' : ''}
                `}
              >
                <span className="text-base leading-none">{t.icon}</span>
                {t.label}
                {t.advisorOnly && (
                  <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-normal">
                    Private
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'overview'   && <OverviewTab    {...props} />}
        {tab === 'estate'     && <EstateTab      {...props} />}
        {tab === 'retirement' && <RetirementTab  {...props} />}
        {tab === 'documents'  && <DocumentsTab   {...props} />}
        {tab === 'notes'      && <NotesTab       {...props} />}
      </div>
    </div>
  )
}

function formatFilingStatus(status: string | null) {
  const map: Record<string, string> = {
    married_filing_jointly: 'Married Filing Jointly',
    married_filing_separately: 'Married Filing Separately',
    single: 'Single',
    head_of_household: 'Head of Household',
    qualifying_widow: 'Qualifying Widow(er)',
  }
  return status ? (map[status] ?? status) : '—'
}

// ── Shared prop types ─────────────────────────────────────────────────────────
export interface ClientViewShellProps {
  tab: string
  advisorId: string
  clientId: string
  household: any
  assets: any[]
  realEstate: any[]
  beneficiaries: any[]
  estateDocuments: any[]
  legalDocuments: any[]
  notes: any[]
}
