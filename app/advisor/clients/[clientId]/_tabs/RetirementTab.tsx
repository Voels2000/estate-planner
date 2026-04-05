'use client'
// app/advisor/clients/[clientId]/_tabs/RetirementTab.tsx
// Retirement planning view — SS optimization, RMD, allocation, planning inputs

import { ClientViewShellProps } from '../_client-view-shell'
import { formatCurrency, getAge } from '../_utils'

export default function RetirementTab({ household, assets }: ClientViewShellProps) {
  const currentYear = new Date().getFullYear()
  const p1Age = getAge(household.person1_birth_year, currentYear) ?? 0
  const p2Age = household.has_spouse ? (getAge(household.person2_birth_year, currentYear) ?? 0) : null

  const retirementAssets = (assets ?? []).filter(a =>
    ['401k','ira','roth_ira','sep_ira','403b','457','pension'].includes(a.account_type?.toLowerCase() ?? '')
  )
  const totalRetirement   = retirementAssets.reduce((s, a) => s + (a.value ?? 0), 0)
  const traditionalAssets = retirementAssets.filter(a => a.account_type?.toLowerCase() !== 'roth_ira')
  const rothAssets        = retirementAssets.filter(a => a.account_type?.toLowerCase() === 'roth_ira')
  const totalTraditional  = traditionalAssets.reduce((s, a) => s + (a.value ?? 0), 0)
  const totalRoth         = rothAssets.reduce((s, a) => s + (a.value ?? 0), 0)

  // ── RMD exposure ─────────────────────────────────────────────────────────
  const rmdAge = 73 // SECURE 2.0
  const p1YearsToRMD = Math.max(0, rmdAge - p1Age)
  const p2YearsToRMD = p2Age !== null ? Math.max(0, rmdAge - p2Age) : null
  const hasRMDExposure = totalTraditional > 0 && (p1YearsToRMD <= 10 || (p2YearsToRMD !== null && p2YearsToRMD <= 10))

  // ── SS optimization flags ─────────────────────────────────────────────────
  const p1SSAge      = household.person1_ss_claiming_age
  const p2SSAge      = household.person2_ss_claiming_age
  const p1SSBenefit67 = household.person1_ss_benefit_67
  const p1SSBenefit62 = household.person1_ss_benefit_62
  const p2SSBenefit67 = household.person2_ss_benefit_67
  const p2SSBenefit62 = household.person2_ss_benefit_62

  const p1SSEarlyVsOptimal = p1SSBenefit67 && p1SSBenefit62
    ? ((p1SSBenefit67 - p1SSBenefit62) / p1SSBenefit62 * 100).toFixed(0)
    : null

  // ── Roth conversion opportunity ───────────────────────────────────────────
  const rothPct = totalRetirement > 0 ? (totalRoth / totalRetirement) * 100 : 0
  const rothConversionOpportunity = totalTraditional > 250_000 && rothPct < 30

  return (
    <div className="space-y-6">

      {/* ── RMD alert ── */}
      {hasRMDExposure && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">RMD Planning Window</p>
          <p className="text-sm text-amber-700 mt-0.5">
            {p1YearsToRMD <= 10 && `${household.person1_first_name} begins RMDs in ${p1YearsToRMD} year${p1YearsToRMD !== 1 ? 's' : ''} (age ${rmdAge}). `}
            {p2YearsToRMD !== null && p2YearsToRMD <= 10 && `${household.person2_first_name} begins RMDs in ${p2YearsToRMD} year${p2YearsToRMD !== 1 ? 's' : ''} (age ${rmdAge}). `}
            {formatCurrency(totalTraditional, true)} in traditional retirement accounts subject to RMD.
            {rothConversionOpportunity && ' Consider Roth conversion strategy before RMD onset.'}
          </p>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <RetirementStat label="Total Retirement"     value={formatCurrency(totalRetirement, true)} sub={`${retirementAssets.length} accounts`} />
        <RetirementStat label="Traditional / Pre-Tax" value={formatCurrency(totalTraditional, true)} sub="Subject to RMD" highlight={totalTraditional > 0} />
        <RetirementStat label="Roth / After-Tax"     value={formatCurrency(totalRoth, true)} sub={`${rothPct.toFixed(0)}% of retirement`} />
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* ── Social Security ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Social Security Strategy</h3>

          <div className="space-y-4">
            <SSPersonCard
              name={household.person1_first_name}
              age={p1Age}
              claimingAge={p1SSAge}
              benefit62={p1SSBenefit62}
              benefit67={p1SSBenefit67}
              delta={p1SSEarlyVsOptimal}
            />
            {household.has_spouse && (
              <SSPersonCard
                name={household.person2_first_name}
                age={p2Age!}
                claimingAge={p2SSAge}
                benefit62={p2SSBenefit62}
                benefit67={p2SSBenefit67}
                delta={null}
              />
            )}
          </div>

          {p1SSAge && p1SSAge < 67 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs font-medium text-amber-800">Early Claiming Alert</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {household.person1_first_name} is set to claim at {p1SSAge}. Delaying to 67 increases monthly benefit
                {p1SSEarlyVsOptimal ? ` by ~${p1SSEarlyVsOptimal}%` : ''}. Discuss break-even analysis.
              </p>
            </div>
          )}
          {!p1SSAge && p1Age >= 55 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-medium text-slate-700">Claiming Strategy Not Set</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {household.person1_first_name} is {p1Age} — within 10 years of eligibility. Document claiming strategy.
              </p>
            </div>
          )}
        </div>

        {/* ── RMD Timeline ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">RMD Timeline</h3>

          <div className="space-y-4">
            <RMDPersonRow
              name={household.person1_first_name}
              age={p1Age}
              yearsToRMD={p1YearsToRMD}
              rmdAge={rmdAge}
              traditionalBalance={
                retirementAssets
                  .filter(a => a.owner === 'person1' && a.account_type?.toLowerCase() !== 'roth_ira')
                  .reduce((s, a) => s + (a.value ?? 0), 0)
              }
            />
            {household.has_spouse && p2Age !== null && p2YearsToRMD !== null && (
              <RMDPersonRow
                name={household.person2_first_name}
                age={p2Age}
                yearsToRMD={p2YearsToRMD}
                rmdAge={rmdAge}
                traditionalBalance={
                  retirementAssets
                    .filter(a => a.owner === 'person2' && a.account_type?.toLowerCase() !== 'roth_ira')
                    .reduce((s, a) => s + (a.value ?? 0), 0)
                }
              />
            )}
          </div>

          {rothConversionOpportunity && (
            <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-xs font-medium text-indigo-800">Roth Conversion Opportunity</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                Only {rothPct.toFixed(0)}% of retirement assets are in Roth accounts.
                With {formatCurrency(totalTraditional, true)} in pre-tax accounts, a systematic Roth conversion
                strategy before RMD onset may reduce lifetime tax burden.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Planning assumptions ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Planning Assumptions</h3>
        <div className="grid grid-cols-4 gap-x-8 gap-y-4 text-sm">
          <Assumption label="Inflation Rate"         value={household.inflation_rate ? `${household.inflation_rate}%` : '—'} />
          <Assumption label="Growth (Accumulation)"  value={household.growth_rate_accumulation ? `${household.growth_rate_accumulation}%` : '—'} />
          <Assumption label="Growth (Retirement)"    value={household.growth_rate_retirement ? `${household.growth_rate_retirement}%` : '—'} />
          <Assumption label="Risk Tolerance"         value={formatRisk(household.risk_tolerance)} />
          <Assumption label={`${household.person1_first_name} Retirement Age`} value={household.person1_retirement_age ? String(household.person1_retirement_age) : 'Not set'} />
          <Assumption label={`${household.person1_first_name} Longevity`}      value={household.person1_longevity_age  ? String(household.person1_longevity_age)  : 'Not set'} />
          {household.has_spouse && <>
            <Assumption label={`${household.person2_first_name} Retirement Age`} value={household.person2_retirement_age ? String(household.person2_retirement_age) : 'Not set'} />
            <Assumption label={`${household.person2_first_name} Longevity`}      value={household.person2_longevity_age  ? String(household.person2_longevity_age)  : 'Not set'} />
          </>}
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RetirementStat({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-amber-800' : 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

function SSPersonCard({ name, age, claimingAge, benefit62, benefit67, delta }: {
  name: string; age: number; claimingAge: number | null
  benefit62: number | null; benefit67: number | null; delta: string | null
}) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-sm font-semibold text-slate-800">{name}</span>
          <span className="text-xs text-slate-400 ml-2">Age {age}</span>
        </div>
        <div className="text-right">
          {claimingAge ? (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              claimingAge >= 67 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              Claiming at {claimingAge}
            </span>
          ) : (
            <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded">Not set</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-400 mb-0.5">At 62</p>
          <p className="font-semibold text-slate-700">{benefit62 ? formatCurrency(benefit62) + '/mo' : '—'}</p>
        </div>
        <div>
          <p className="text-slate-400 mb-0.5">At 67 (FRA)</p>
          <p className="font-semibold text-slate-700">{benefit67 ? formatCurrency(benefit67) + '/mo' : '—'}</p>
        </div>
      </div>
    </div>
  )
}

function RMDPersonRow({ name, age, yearsToRMD, rmdAge, traditionalBalance }: {
  name: string; age: number; yearsToRMD: number; rmdAge: number; traditionalBalance: number
}) {
  const urgency = yearsToRMD === 0 ? 'critical' : yearsToRMD <= 3 ? 'high' : yearsToRMD <= 10 ? 'moderate' : 'low'
  const barPct  = Math.max(0, Math.min(100, ((rmdAge - age) / rmdAge) * 100))

  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-slate-800">{name}, age {age}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          urgency === 'critical' ? 'bg-red-100 text-red-700'     :
          urgency === 'high'     ? 'bg-orange-100 text-orange-700' :
          urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                                   'bg-slate-100 text-slate-600'
        }`}>
          {yearsToRMD === 0 ? 'RMDs Active' : `${yearsToRMD}yr to RMD`}
        </span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${
          urgency === 'critical' ? 'bg-red-500'    :
          urgency === 'high'     ? 'bg-orange-400' :
          urgency === 'moderate' ? 'bg-amber-400'  : 'bg-slate-400'
        }`} style={{ width: `${100 - barPct}%` }} />
      </div>
      <p className="text-xs text-slate-500">
        Pre-tax balance: <span className="font-semibold text-slate-700">{formatCurrency(traditionalBalance, true)}</span>
      </p>
    </div>
  )
}

function Assumption({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}

function formatRisk(r: string | null) {
  const map: Record<string, string> = {
    conservative:           'Conservative',
    moderately_conservative: 'Mod. Conservative',
    moderate:               'Moderate',
    moderately_aggressive:  'Mod. Aggressive',
    aggressive:             'Aggressive',
  }
  return r ? (map[r] ?? r) : '—'
}
