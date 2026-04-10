'use client'
import type { DomicileScheduleRow } from '@/lib/projection/domicileEngine'
import type { DbStateExemption } from '@/lib/projection/stateRegistry'
import type { PDFReportData } from '@/lib/export/generatePDFReport'
import type { ExcelExportData } from '@/lib/export/generateExcelExport'
import type { BeneficiaryAccessGrant } from '@/lib/types/beneficiary-grant'
import type { ScenarioVersion, ActionItem, MonteCarloSummary } from '@/lib/export-wiring'
import type { ExportProjectionRow, TaxSummaryExport } from '@/components/advisor/ExportPanel'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { TabSkeleton, StrategyTabSkeleton, DomicileTabSkeleton } from '@/components/ui/TabSkeleton'
import OverviewTab from './_tabs/OverviewTab'
import EstateTab from './_tabs/EstateTab'
import RetirementTab from './_tabs/RetirementTab'
import TaxTab from './_tabs/TaxTab'
import DomicileTab from './_tabs/DomicileTab'
import DocumentsTab from './_tabs/DocumentsTab'
import NotesTab from './_tabs/NotesTab'
import StrategyTab from './_tabs/StrategyTab'
import MeetingPrepTab from './_tabs/MeetingPrepTab'
import { getComplexityStyle, getAge, formatCurrency } from './_utils'

const TABS: { id: string; label: string; icon: string; advisorOnly?: boolean; comingSoon?: boolean }[] = [
  { id: 'overview',   label: 'Overview',   icon: '◎' },
  { id: 'strategy',   label: 'Strategy',   icon: '📈' },
  { id: 'tax',        label: 'Tax',        icon: '◆' },
  { id: 'domicile',   label: 'Domicile',   icon: '⊙' },
  { id: 'estate',     label: 'Estate',     icon: '⬡' },
  { id: 'retirement', label: 'Retirement', icon: '◷' },
  { id: 'documents',  label: 'Documents',  icon: '⊞' },
  { id: 'notes',      label: 'Notes',      icon: '✎', advisorOnly: true },
  { id: 'meeting-prep', label: 'Meeting Prep', icon: '📋' },
]

const CLIENT_STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  needs_review: 'bg-amber-100 text-amber-700',
  at_risk: 'bg-red-100 text-red-700',
  inactive: 'bg-neutral-100 text-neutral-500',
}

function formatClientStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

export default function ClientViewShell(props: ClientViewShellProps) {
  const { tab, household, clientStatus: clientStatusProp } = props
  const clientStatus = clientStatusProp ?? 'active'
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setTab = useCallback((t: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  const [, startTransition] = useTransition()
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  const handleTabClick = useCallback(
    (id: string) => {
      const t = TABS.find(x => x.id === id)
      if (!t || t.comingSoon) return
      if (id === tab) return
      setPendingTab(id)
      startTransition(() => {
        setTab(id)
      })
    },
    [tab, setTab],
  )

  useEffect(() => {
    if (pendingTab !== null && pendingTab === tab) {
      setPendingTab(null)
    }
  }, [tab, pendingTab])

  const navigatingTo = pendingTab !== null && pendingTab !== tab ? pendingTab : null

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
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-semibold text-slate-900">{clientName}</h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    CLIENT_STATUS_BADGE[clientStatus] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {formatClientStatusLabel(clientStatus)}
                </span>
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
                onClick={() => !t.comingSoon && handleTabClick(t.id)}
                disabled={t.comingSoon}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150
                  ${tab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : t.comingSoon
                      ? 'border-transparent text-slate-300 cursor-not-allowed'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }
                  ${pendingTab === t.id ? 'opacity-70 ring-2 ring-indigo-300 ring-offset-1 rounded-sm' : ''}
                  ${t.advisorOnly ? 'ml-auto' : ''}
                `}
              >
                <span className="text-base leading-none">{t.icon}</span>
                {t.label}
                {t.comingSoon && (
                  <span className="ml-1 text-xs bg-neutral-100 text-neutral-400 px-1.5 py-0.5 rounded font-normal">
                    Sprint 59
                  </span>
                )}
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
        {navigatingTo === 'strategy' && <StrategyTabSkeleton />}
        {navigatingTo === 'domicile' && <DomicileTabSkeleton />}
        {navigatingTo === 'tax' && <TabSkeleton rows={3} />}
        {navigatingTo === 'estate' && <TabSkeleton rows={4} />}
        {navigatingTo === 'retirement' && <TabSkeleton rows={3} />}
        {navigatingTo === 'meeting-prep' && <TabSkeleton rows={2} showHeader={false} />}

        {!navigatingTo && (
          <>
            {tab === 'overview'   && <OverviewTab    {...props} />}
            {tab === 'estate'     && <EstateTab      {...props} />}
            {tab === 'retirement' && <RetirementTab  {...props} />}
            {tab === 'tax'        && <TaxTab         {...props} />}
            {tab === 'domicile'   && <DomicileTab    {...props} />}
            {tab === 'documents'  && <DocumentsTab   {...props} />}
            {tab === 'notes'      && <NotesTab       {...props} />}
            {tab === 'strategy'   && <StrategyTab    {...props} />}
            {tab === 'meeting-prep' && <MeetingPrepTab {...props} />}
          </>
        )}
      </div>
    </div>
  )
}

function formatFilingStatus(status: string | null) {
  const map: Record<string, string> = {
    married_filing_jointly:    'Married Filing Jointly',
    married_filing_separately: 'Married Filing Separately',
    single:                    'Single',
    head_of_household:         'Head of Household',
    qualifying_widow:          'Qualifying Widow(er)',
  }
  return status ? (map[status] ?? status) : '—'
}

// ── Shared prop types ─────────────────────────────────────────────────────────
export interface ClientViewShellProps {
  tab: string
  advisorId: string
  clientId: string
  clientStatus?: string | null
  household: any
  assets: any[]
  realEstate: any[]
  beneficiaries: any[]
  estateDocuments: any[]
  legalDocuments: any[]
  notes: any[]
  estateTax: any | null
  scenario?: {
    id?: string
    gross_estate?: number
    federal_exemption?: number
    annual_rmd?: number
    pre_ira_balance?: number
    estimated_federal_tax?: number
    estimated_state_tax?: number
    law_scenario?: 'current_law' | 'sunset' | 'no_exemption'
  } | null
  scenarioHistory?: ScenarioVersion[]
  exportPdfData?: PDFReportData
  exportExcelData?: ExcelExportData
  exportPanelProps?: {
    householdId: string
    scenarioId: string
    advisorName: string
    healthScore: number | null
    liquidAssets: number
    activeStrategies: string[]
    actionItems: ActionItem[]
    projectionData: ExportProjectionRow[]
    taxSummary: TaxSummaryExport | null
    monteCarloRun: boolean
    monteCarloResults: MonteCarloSummary | null
    liquidityShortfall: boolean
    scenarioHistory: ScenarioVersion[]
  }
  projectionRowsDomicile?: Array<{ year: number; gross_estate: number; estate_incl_home?: number }>
  beneficiaryGrants?: BeneficiaryAccessGrant[]
  domicileAnalysis: any | null
  domicileSchedule: DomicileScheduleRow[] | null
  domicileChecklist: any[]
  stateExemptions: DbStateExemption[]
  conflictReport?: {
    conflicts: Array<{
      conflict_type: string
      severity: 'critical' | 'warning' | 'info'
      description: string
      recommended_action: string
      asset_id: string | null
      real_estate_id: string | null
    }>
    critical: number
    warnings: number
  } | null
}
