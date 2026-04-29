'use client'

/**
 * Advisor Domicile tab: residency-risk signals, tax impact comparisons, domicile
 * checklist/schedule context, and move breakeven tools.
 */

import { useEffect, useState } from 'react'
import DomicileScheduleEditor from '@/components/advisor/DomicileScheduleEditor'
import InheritanceTaxWaterfall from '@/components/advisor/InheritanceTaxWaterfall'
import NYCliffValidator from '@/components/advisor/NYCliffValidator'
import StateTaxPanel from '@/components/advisor/StateTaxPanel'
import MoveBreakevenPanel from '@/components/advisor/MoveBreakevenPanel'
import { parseStateTaxCode } from '@/lib/projection/stateRegistry'
import type { StateIncomeTaxBracket } from '@/lib/domicile/moveBreakeven'
import { ClientViewShellProps } from '../_client-view-shell'

/** Temporary federal exemption input for inheritance waterfall rendering. */
const FEDERAL_EXEMPTION_PLACEHOLDER = 13_610_000
const COLLAPSE_STATE_VERSION = 'v1'

export default function DomicileTab({
  domicileAnalysis,
  household,
  clientId,
  domicileSchedule,
  domicileChecklist,
  stateExemptions,
  stateEstateTaxRules,
  stateIncomeTaxBrackets = [],
  projectionRowsDomicile = [],
}: ClientViewShellProps) {
  type DomicileAnalysisRow = {
    claimed_domicile_state?: string | null
    risk_score?: number | null
    risk_level?: string | null
    conflict_states?: string[] | null
    recommendations?: string[] | null
    drivers_license_state?: string | null
    voter_registration_state?: string | null
    vehicle_registration_state?: string | null
    primary_home_titled_state?: string | null
    spouse_children_state?: string | null
    estate_docs_declare_state?: string | null
    files_taxes_in_state?: string | null
    business_interests_state?: string | null
    states?: Array<{ state?: string | null; days_per_year?: number | null }> | null
    updated_at?: string | null
    gross_estate?: number | null
  }

  const [liveAnalysis, setLiveAnalysis] = useState(domicileAnalysis)
  const [isInheritanceOpen, setIsInheritanceOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [isBreakevenOpen, setIsBreakevenOpen] = useState(false)

  const collapseStoragePrefix = `advisor:domicile:${COLLAPSE_STATE_VERSION}:${clientId ?? household?.id ?? 'unknown'}`
  const inheritanceKey = `${collapseStoragePrefix}:inheritance-open`
  const scheduleKey = `${collapseStoragePrefix}:schedule-open`
  const breakevenKey = `${collapseStoragePrefix}:breakeven-open`

  useEffect(() => {
    let cancelled = false
    async function loadLatest() {
      if (!clientId) return
      try {
        const res = await fetch(`/api/domicile-analysis?client_id=${encodeURIComponent(clientId)}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload = (await res.json()) as { analysis?: DomicileAnalysisRow | null }
        if (!cancelled && payload.analysis) {
          setLiveAnalysis(payload.analysis)
        }
      } catch {
        // Keep server-provided analysis as fallback.
      }
    }
    void loadLatest()
    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const storedInheritance = window.localStorage.getItem(inheritanceKey)
      const storedSchedule = window.localStorage.getItem(scheduleKey)
      const storedBreakeven = window.localStorage.getItem(breakevenKey)
      if (storedInheritance != null) setIsInheritanceOpen(storedInheritance === '1')
      if (storedSchedule != null) setIsScheduleOpen(storedSchedule === '1')
      if (storedBreakeven != null) setIsBreakevenOpen(storedBreakeven === '1')
    } catch {
      // Ignore storage access errors and keep defaults.
    }
  }, [inheritanceKey, scheduleKey, breakevenKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(inheritanceKey, isInheritanceOpen ? '1' : '0')
    } catch {
      // Ignore storage access errors.
    }
  }, [inheritanceKey, isInheritanceOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(scheduleKey, isScheduleOpen ? '1' : '0')
    } catch {
      // Ignore storage access errors.
    }
  }, [scheduleKey, isScheduleOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(breakevenKey, isBreakevenOpen ? '1' : '0')
    } catch {
      // Ignore storage access errors.
    }
  }, [breakevenKey, isBreakevenOpen])

  if (!liveAnalysis) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center text-slate-400">
        <span className="text-4xl mb-3">⊙</span>
        <p className="text-sm font-medium">No domicile analysis on file</p>
        <p className="text-xs mt-1 text-center max-w-xs">
          The client has not completed a domicile analysis yet.
          Ask them to complete the Domicile Analysis module in their dashboard.
        </p>
      </div>
    )
  }

  const analysis = liveAnalysis as DomicileAnalysisRow
  const {
    claimed_domicile_state,
    risk_score,
    risk_level,
    conflict_states,
    recommendations,
    drivers_license_state,
    voter_registration_state,
    vehicle_registration_state,
    primary_home_titled_state,
    spouse_children_state,
    estate_docs_declare_state,
    files_taxes_in_state,
    business_interests_state,
    states,
    updated_at,
  } = analysis

  const score = risk_score ?? 0
  const level = risk_level ?? 'unknown'
  const conflicts: string[] = conflict_states ?? []
  const recs: string[] = recommendations ?? []

  const { scoreColor, scoreBg, levelColor, levelBg, levelLabel } = getRiskStyle(level)
  const currentYear = new Date().getFullYear()
  const projectedTransition = getProjectedTransitionRisk({
    schedule: domicileSchedule ?? [],
    currentState: claimed_domicile_state ?? household?.state_primary ?? null,
    states: states ?? [],
    driversLicense: drivers_license_state,
    voterRegistration: voter_registration_state,
    vehicleRegistration: vehicle_registration_state,
    primaryHome: primary_home_titled_state,
    spouseChildren: spouse_children_state,
    estateDocs: estate_docs_declare_state,
    filesTaxes: files_taxes_in_state,
    businessState: business_interests_state,
    currentYear,
  })

  const grossEstateForStateTax =
    (projectionRowsDomicile.length > 0
      ? (projectionRowsDomicile[0]?.estate_incl_home ?? projectionRowsDomicile[0]?.gross_estate)
      : undefined) ??
    (typeof analysis.gross_estate === 'number' ? analysis.gross_estate : undefined) ??
    0

  const grossEstateByYear = Object.fromEntries(
    projectionRowsDomicile.map((r) => [r.year, r.estate_incl_home ?? r.gross_estate ?? 0]),
  )

  const clientStatesForBreakeven = (states ?? [])
    .filter((s) => typeof s?.state === 'string' && s.state.trim().length > 0)
    .map((s) => ({
      state: String(s.state).trim().toUpperCase().slice(0, 2),
      days_per_year: Number(s.days_per_year ?? 0),
    }))

  const breakevenCurrentState = (claimed_domicile_state ?? household?.state_primary ?? 'WA')
    .trim()
    .slice(0, 2)
    .toUpperCase()

  const factors = [
    { label: "Driver's License",       value: drivers_license_state,      weight: 15 },
    { label: 'Voter Registration',      value: voter_registration_state,   weight: 15 },
    { label: 'Primary Home Titled',     value: primary_home_titled_state,  weight: 15 },
    { label: 'Days Present',            value: getDaysLabel(states),       weight: 20 },
    { label: 'Estate Documents',        value: estate_docs_declare_state,  weight: 10 },
    { label: 'Spouse / Children',       value: spouse_children_state,      weight: 10 },
    { label: 'Vehicle Registration',    value: vehicle_registration_state, weight: 5  },
    { label: 'Files Taxes In',          value: files_taxes_in_state,       weight: 5  },
    { label: 'Business Interests',      value: business_interests_state,   weight: 5  },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Domicile Risk Analysis</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Claimed domicile: <span className="font-medium text-slate-700">{claimed_domicile_state ?? '—'}</span>
            {updated_at && (
              <span className="ml-2 text-slate-400">· Last updated {formatDate(updated_at)}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${scoreColor}`}>{score}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Risk Score</div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${levelBg} ${levelColor}`}>
            {levelLabel}
          </span>
        </div>
      </div>

      {/* ── Risk score bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Low risk</span>
          <span>Critical risk</span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreBg}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
          <span>0–20 Low</span>
          <span>21–45 Moderate</span>
          <span>46–70 High</span>
          <span>71–100 Critical</span>
        </div>
      </div>

      {projectedTransition && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Projected transition risk</h3>
              <p className="text-xs text-slate-500 mt-1">
                Scenario: move to <span className="font-medium text-slate-700">{projectedTransition.targetState}</span> in{' '}
                <span className="font-medium text-slate-700">{projectedTransition.transitionYear}</span>.
              </p>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${projectedTransition.style.scoreColor}`}>{projectedTransition.score}</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${projectedTransition.style.levelBg} ${projectedTransition.style.levelColor}`}>
                {projectedTransition.style.levelLabel}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Uses current domicile factors and day-counts against the planned target state. Update legal/registration/tax ties and day-counts to reduce transition risk.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">

        {/* ── Factor breakdown ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Factor Breakdown</h3>
          <div className="space-y-3">
            {factors.map(f => {
              const isConflict = f.value && f.value !== claimed_domicile_state
              const isEmpty = !f.value
              return (
                <div key={f.label} className={`flex items-center justify-between p-2.5 rounded-lg ${
                  isConflict ? 'bg-red-50' : isEmpty ? 'bg-slate-50' : 'bg-emerald-50'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-sm ${
                      isConflict ? 'text-red-500' : isEmpty ? 'text-slate-300' : 'text-emerald-600'
                    }`}>
                      {isConflict ? '✗' : isEmpty ? '○' : '✓'}
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${
                        isConflict ? 'text-red-800' : isEmpty ? 'text-slate-500' : 'text-emerald-800'
                      }`}>
                        {f.label}
                      </p>
                      {f.value && (
                        <p className="text-xs text-slate-400">{f.value}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">{f.weight}% weight</span>
                    {isConflict && (
                      <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Conflict</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">

          {/* ── Conflict states ── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Conflict States</h3>
            {conflicts.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                <span className="text-emerald-600">✓</span>
                <p className="text-sm text-emerald-700 font-medium">No conflict states identified</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {conflicts.map((state: string) => (
                  <span key={state} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
                    {state}
                  </span>
                ))}
              </div>
            )}
            {conflicts.length > 0 && (
              <p className="text-xs text-slate-400 mt-3">
                These states have documented ties that conflict with the claimed domicile of {claimed_domicile_state}.
                Each conflict increases the risk of a successful domicile challenge.
              </p>
            )}
          </div>

          {/* ── Recommendations ── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Recommendations</h3>
            {recs.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                <span className="text-emerald-600">✓</span>
                <p className="text-sm text-emerald-700 font-medium">No actions required</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recs.map((rec: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Days present ── */}
          {states && Array.isArray(states) && states.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Days Present by State</h3>
              <div className="space-y-2">
                {states.map((s: { state?: string | null; days_per_year?: number | null }, i: number) => {
                  const days = Number(s.days_per_year ?? 0)
                  const pct = Math.min(100, Math.round((days / 365) * 100))
                  const isRisky = days > 183
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`font-medium ${isRisky ? 'text-red-700' : 'text-slate-700'}`}>
                          {s.state}
                          {isRisky && <span className="ml-1.5 text-red-500">⚠ 183+ days</span>}
                        </span>
                        <span className="text-slate-400">{days} days/yr</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isRisky ? 'bg-red-400' : s.state === claimed_domicile_state ? 'bg-emerald-400' : 'bg-slate-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Projection-backed gross estate panels */}
      <div className="space-y-6">
        {household?.state_primary === 'NY' && (
          <NYCliffValidator
            year={new Date().getFullYear() + 1}
            dbExemptions={stateExemptions}
            stateEstateTaxRules={stateEstateTaxRules}
          />
        )}
        <StateTaxPanel
          grossEstate={grossEstateForStateTax}
          stateCode={parseStateTaxCode(claimed_domicile_state ?? 'WA')}
          profileStateAbbrev={claimed_domicile_state ?? household?.state_primary}
          federalExemption={FEDERAL_EXEMPTION_PLACEHOLDER}
          dbExemptions={stateExemptions}
          stateAbbrev={claimed_domicile_state ?? household?.state_primary}
          stateEstateTaxRules={stateEstateTaxRules}
          isMFJ={household?.filing_status === 'mfj'}
          projectedGrossEstateByYear={projectionRowsDomicile}
        />
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Domicile Schedule</h3>
            <button
              type="button"
              onClick={() => setIsScheduleOpen((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {isScheduleOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          {isScheduleOpen && (
            <div className="mt-4">
              <DomicileScheduleEditor
                householdId={household.id}
                currentState={claimed_domicile_state ?? 'WA'}
                grossEstateByYear={grossEstateByYear}
                federalExemption={FEDERAL_EXEMPTION_PLACEHOLDER}
                filingStatus={household?.filing_status}
                initialSchedule={domicileSchedule ?? []}
                initialChecklist={
                  (domicileChecklist ?? []) as Array<{
                    id: string
                    category?: string | null
                    label?: string | null
                    description?: string | null
                    priority?: string | null
                    completed?: boolean | null
                    completed_at?: string | null
                  }>
                }
                dbExemptions={stateExemptions}
                stateEstateTaxRules={stateEstateTaxRules}
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Move Breakeven Analysis</h3>
            <button
              type="button"
              onClick={() => setIsBreakevenOpen((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {isBreakevenOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          {isBreakevenOpen && (
            <div className="mt-4">
              <MoveBreakevenPanel
                currentState={breakevenCurrentState}
                grossEstate={grossEstateForStateTax}
                isMFJ={household?.filing_status === 'mfj'}
                clientStates={clientStatesForBreakeven}
                incomeTaxBrackets={stateIncomeTaxBrackets as StateIncomeTaxBracket[]}
                estateTaxRules={stateEstateTaxRules ?? []}
                scheduledTargetState={projectedTransition?.targetState ?? null}
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Inheritance Tax by State</h3>
            <button
              type="button"
              onClick={() => setIsInheritanceOpen((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {isInheritanceOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          {isInheritanceOpen && (
            <div className="mt-4">
              <InheritanceTaxWaterfall
                inheritanceAmount={grossEstateForStateTax}
                year={new Date().getFullYear() + 1}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function mapRiskLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (score <= 20) return 'low'
  if (score <= 45) return 'moderate'
  if (score <= 70) return 'high'
  return 'critical'
}

function normalizedState(value: string | null | undefined): string | null {
  const v = value?.trim().toUpperCase()
  return v ? v : null
}

function getProjectedTransitionRisk(params: {
  schedule: Array<{ effective_year: number; state_code: string }>
  currentState: string | null
  states: Array<{ state?: string | null; days_per_year?: number | null }>
  driversLicense: string | null | undefined
  voterRegistration: string | null | undefined
  vehicleRegistration: string | null | undefined
  primaryHome: string | null | undefined
  spouseChildren: string | null | undefined
  estateDocs: string | null | undefined
  filesTaxes: string | null | undefined
  businessState: string | null | undefined
  currentYear: number
}) {
  const currentState = normalizedState(params.currentState)
  const transition = params.schedule
    .filter((r) => r.effective_year >= params.currentYear)
    .find((r) => normalizedState(r.state_code) && normalizedState(r.state_code) !== currentState)
  if (!transition) return null

  const targetState = normalizedState(transition.state_code)!
  const weightedFactors: Array<{ value: string | null; weight: number }> = [
    { value: normalizedState(params.driversLicense), weight: 15 },
    { value: normalizedState(params.voterRegistration), weight: 15 },
    { value: normalizedState(params.primaryHome), weight: 15 },
    { value: normalizedState(params.estateDocs), weight: 10 },
    { value: normalizedState(params.spouseChildren), weight: 10 },
    { value: normalizedState(params.vehicleRegistration), weight: 5 },
    { value: normalizedState(params.filesTaxes), weight: 5 },
    { value: normalizedState(params.businessState), weight: 5 },
  ]

  let score = weightedFactors.reduce((sum, factor) => {
    if (!factor.value) return sum
    return sum + (factor.value === targetState ? 0 : factor.weight)
  }, 0)

  const targetDays = (params.states ?? [])
    .filter((s) => normalizedState(s.state) === targetState)
    .reduce((sum, s) => sum + Number(s.days_per_year ?? 0), 0)
  const maxOtherDays = Math.max(
    0,
    ...(params.states ?? [])
      .filter((s) => normalizedState(s.state) !== targetState)
      .map((s) => Number(s.days_per_year ?? 0)),
  )
  const hasDaysConflict = targetDays < 183 || maxOtherDays >= 183 || maxOtherDays > targetDays
  if (hasDaysConflict) score += 20

  const clamped = Math.max(0, Math.min(100, score))
  const level = mapRiskLevel(clamped)
  return {
    targetState,
    transitionYear: transition.effective_year,
    score: clamped,
    style: getRiskStyle(level),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRiskStyle(level: string) {
  switch (level) {
    case 'low':
      return {
        scoreColor: 'text-emerald-700',
        scoreBg:    'bg-emerald-500',
        levelColor: 'text-emerald-700',
        levelBg:    'bg-emerald-50',
        levelLabel: 'Low Risk',
      }
    case 'moderate':
      return {
        scoreColor: 'text-amber-700',
        scoreBg:    'bg-amber-400',
        levelColor: 'text-amber-700',
        levelBg:    'bg-amber-50',
        levelLabel: 'Moderate Risk',
      }
    case 'high':
      return {
        scoreColor: 'text-orange-700',
        scoreBg:    'bg-orange-500',
        levelColor: 'text-orange-700',
        levelBg:    'bg-orange-50',
        levelLabel: 'High Risk',
      }
    case 'critical':
      return {
        scoreColor: 'text-red-700',
        scoreBg:    'bg-red-500',
        levelColor: 'text-red-700',
        levelBg:    'bg-red-50',
        levelLabel: 'Critical Risk',
      }
    default:
      return {
        scoreColor: 'text-slate-600',
        scoreBg:    'bg-slate-400',
        levelColor: 'text-slate-600',
        levelBg:    'bg-slate-100',
        levelLabel: 'Not Scored',
      }
  }
}

function getDaysLabel(states: Array<{ state?: string | null; days_per_year?: number | null }> | null | undefined): string | null {
  if (!states || !Array.isArray(states)) return null
  const sorted = [...states].sort(
    (a, b) => Number(b.days_per_year ?? 0) - Number(a.days_per_year ?? 0),
  )
  if (sorted.length === 0) return null
  const top = sorted[0]
  return `${top.state} (${Number(top.days_per_year ?? 0)} days)`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
