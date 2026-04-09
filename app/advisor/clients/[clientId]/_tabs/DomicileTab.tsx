'use client'
// app/advisor/clients/[clientId]/_tabs/DomicileTab.tsx
// Domicile risk analysis — read-only advisor view
// Data comes from domicile_analysis table, pre-scored by calculate_domicile_risk() RPC

import DomicileScheduleEditor from '@/components/advisor/DomicileScheduleEditor'
import InheritanceTaxWaterfall from '@/components/advisor/InheritanceTaxWaterfall'
import NYCliffValidator from '@/components/advisor/NYCliffValidator'
import StateTaxPanel from '@/components/advisor/StateTaxPanel'
import { parseStateTaxCode } from '@/lib/projection/stateRegistry'
import { ClientViewShellProps } from '../_client-view-shell'

/** Sprint 66: align with combined federal/state waterfall when available */
const FEDERAL_EXEMPTION_PLACEHOLDER = 13_610_000

export default function DomicileTab({
  domicileAnalysis,
  household,
  clientId,
  domicileSchedule,
  domicileChecklist,
  stateExemptions,
}: ClientViewShellProps) {

  if (!domicileAnalysis) {
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
  } = domicileAnalysis

  const score = risk_score ?? 0
  const level = risk_level ?? 'unknown'
  const conflicts: string[] = conflict_states ?? []
  const recs: string[] = recommendations ?? []

  const { scoreColor, scoreBg, levelColor, levelBg, levelLabel } = getRiskStyle(level)

  const grossEstateForStateTax =
    parseStateTaxCode(claimed_domicile_state ?? '') === 'NY'
      ? 8_000_000 // temp for NY cliff validation
      : (typeof domicileAnalysis?.gross_estate === 'number' ? domicileAnalysis.gross_estate : undefined) ??
        (typeof household?.gross_estate === 'number' ? household.gross_estate : undefined) ??
        0

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
                {states.map((s: any, i: number) => {
                  const days = s.days_per_year ?? 0
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

      {/* Sprint 66: wire grossEstate / grossEstateByYear from projection waterfall */}
      <div className="space-y-6">
        {parseStateTaxCode(claimed_domicile_state ?? '') === 'NY' && (
          <NYCliffValidator
            year={new Date().getFullYear() + 1}
            dbExemptions={stateExemptions}
          />
        )}
        <StateTaxPanel
          grossEstate={grossEstateForStateTax}
          stateCode={parseStateTaxCode(claimed_domicile_state ?? 'WA')}
          federalExemption={FEDERAL_EXEMPTION_PLACEHOLDER}
          dbExemptions={stateExemptions}
        />
        <DomicileScheduleEditor
          householdId={household.id}
          currentState={claimed_domicile_state ?? 'WA'}
          grossEstateByYear={{}}
          federalExemption={FEDERAL_EXEMPTION_PLACEHOLDER}
          initialSchedule={domicileSchedule ?? []}
          initialChecklist={domicileChecklist ?? []}
          dbExemptions={stateExemptions}
        />
        <InheritanceTaxWaterfall
          inheritanceAmount={grossEstateForStateTax}
          year={new Date().getFullYear() + 1}
        />
      </div>
    </div>
  )
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

function getDaysLabel(states: any): string | null {
  if (!states || !Array.isArray(states)) return null
  const sorted = [...states].sort((a, b) => (b.days_per_year ?? 0) - (a.days_per_year ?? 0))
  if (sorted.length === 0) return null
  const top = sorted[0]
  return `${top.state} (${top.days_per_year} days)`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
