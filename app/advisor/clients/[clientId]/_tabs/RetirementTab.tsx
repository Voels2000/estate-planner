'use client'

/**
 * Advisor Retirement tab: Social Security timing, RMD context, retirement account
 * composition, and plan-level retirement assumptions.
 */

import { getSsBenefitFromPia, getFraFromBirthYear } from '@/lib/calculations/projection-complete'
import { ClientViewShellProps } from '../_client-view-shell'
import { formatCurrency, getAge } from '../_utils'

type RetirementAssetRow = {
  id: string
  type?: string | null
  account_type?: string | null
  value?: number | null
  owner?: string | null
}

export default function RetirementTab({ household, assets }: ClientViewShellProps) {
  const currentYear = new Date().getFullYear()
  const person1BirthYear = typeof household.person1_birth_year === 'number' ? household.person1_birth_year : null
  const person2BirthYear = typeof household.person2_birth_year === 'number' ? household.person2_birth_year : null
  const p1Age = getAge(person1BirthYear, currentYear) ?? 0
  const p2Age = household.has_spouse ? (getAge(person2BirthYear, currentYear) ?? 0) : null

  const pia1 = Number(household.person1_ss_pia ?? 0)
  const claimAge1 = Number(household.person1_ss_claiming_age ?? 67)
  const birthYear1 = person1BirthYear ?? 1960
  const fra1 = getFraFromBirthYear(birthYear1)
  const computedSS1Annual = getSsBenefitFromPia(pia1, claimAge1, birthYear1)
  const computedSS1Monthly = Math.round(computedSS1Annual / 12)
  const ssAdjustment1 = pia1 > 0 ? (computedSS1Monthly - pia1) / pia1 : 0

  const pia2 = Number(household.person2_ss_pia ?? 0)
  const claimAge2 = Number(household.person2_ss_claiming_age ?? 67)
  const birthYear2 = person2BirthYear ?? 1960
  const fra2 = getFraFromBirthYear(birthYear2)
  const computedSS2Annual = household.has_spouse ? getSsBenefitFromPia(pia2, claimAge2, birthYear2) : 0
  const computedSS2Monthly = Math.round(computedSS2Annual / 12)
  const ssAdjustment2 = pia2 > 0 ? (computedSS2Monthly - pia2) / pia2 : 0

  const accountType = (a: { type?: string | null; account_type?: string | null }) =>
    (a.type ?? a.account_type ?? '').toLowerCase()
  const normalizedRetirementType = (a: { type?: string | null; account_type?: string | null }) => {
    const raw = accountType(a)
    if (raw === 'traditional_401k') return '401k'
    if (raw === 'traditional_ira' || raw === 'rollover_ira') return 'ira'
    return raw
  }

  const assetRows = (assets ?? []) as RetirementAssetRow[]
  const retirementAssets = assetRows.filter(a =>
    ['401k', 'ira', 'roth_ira', 'sep_ira', '403b', '457', 'pension'].includes(normalizedRetirementType(a))
  )
  const totalRetirement   = retirementAssets.reduce((s, a) => s + Number(a.value ?? 0), 0)
  const traditionalAssets = retirementAssets.filter(a => accountType(a) !== 'roth_ira')
  const rothAssets        = retirementAssets.filter(a => accountType(a) === 'roth_ira')
  const totalTraditional  = traditionalAssets.reduce((s, a) => s + Number(a.value ?? 0), 0)
  const totalRoth         = rothAssets.reduce((s, a) => s + Number(a.value ?? 0), 0)

  // ── RMD exposure ─────────────────────────────────────────────────────────
  const rmdAge = 73 // SECURE 2.0
  const p1YearsToRMD = Math.max(0, rmdAge - p1Age)
  const p2YearsToRMD = p2Age !== null ? Math.max(0, rmdAge - p2Age) : null
  const hasRMDExposure = totalTraditional > 0 && (p1YearsToRMD <= 10 || (p2YearsToRMD !== null && p2YearsToRMD <= 10))

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
        <div className="space-y-4">
          <SsPiaCard
            title={household.person1_first_name ?? 'Person 1'}
            pia={pia1}
            claimingAge={typeof household.person1_ss_claiming_age === 'number' ? household.person1_ss_claiming_age : null}
            computedMonthly={computedSS1Monthly}
            ssAdjustment={ssAdjustment1}
            fra={fra1}
          />
          {household.has_spouse && (
            <SsPiaCard
              title={household.person2_first_name ?? 'Person 2'}
              pia={pia2}
              claimingAge={typeof household.person2_ss_claiming_age === 'number' ? household.person2_ss_claiming_age : null}
              computedMonthly={computedSS2Monthly}
              ssAdjustment={ssAdjustment2}
              fra={fra2}
            />
          )}
        </div>

        {/* ── RMD Timeline ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">RMD Timeline</h3>

          <div className="space-y-4">
            <RMDPersonRow
              name={household.person1_first_name ?? 'Person 1'}
              age={p1Age}
              yearsToRMD={p1YearsToRMD}
              rmdAge={rmdAge}
              traditionalBalance={
                retirementAssets
                  .filter(a => a.owner === 'person1' && accountType(a) !== 'roth_ira')
                  .reduce((s, a) => s + Number(a.value ?? 0), 0)
              }
            />
            {household.has_spouse && p2Age !== null && p2YearsToRMD !== null && (
              <RMDPersonRow
                name={household.person2_first_name ?? 'Person 2'}
                age={p2Age}
                yearsToRMD={p2YearsToRMD}
                rmdAge={rmdAge}
                traditionalBalance={
                  retirementAssets
                    .filter(a => a.owner === 'person2' && accountType(a) !== 'roth_ira')
                      .reduce((s, a) => s + Number(a.value ?? 0), 0)
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
          <Assumption label="Risk Tolerance"         value={formatRisk(household.risk_tolerance ?? null)} />
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

function SsPiaCard({
  title,
  pia,
  claimingAge,
  computedMonthly,
  ssAdjustment,
  fra,
}: {
  title: string
  pia: number
  claimingAge: number | null
  computedMonthly: number
  ssAdjustment: number
  fra: number
}) {
  const claim = claimingAge ?? null
  const showEarlyWarning = pia > 0 && claim != null && claim < fra

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        Social Security — {title}
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">PIA (FRA Amount)</p>
          <p className="text-lg font-bold text-slate-800">
            {formatCurrency(pia)}/mo
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Claiming Age</p>
          <p className="text-lg font-bold text-slate-800">
            {claimingAge ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Projected Monthly at Claim Age</p>
          <p className="text-lg font-bold text-indigo-700">
            {formatCurrency(computedMonthly)}/mo
          </p>
          {ssAdjustment !== 0 && (
            <p className={`text-xs mt-0.5 ${ssAdjustment < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {ssAdjustment < 0 ? '▼' : '▲'} {Math.abs(Math.round(ssAdjustment * 100))}% vs FRA
            </p>
          )}
        </div>
      </div>
      {showEarlyWarning && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            ⚠ Claiming at {claim} reduces benefit by{' '}
            {Math.abs(Math.round(ssAdjustment * 100))}% vs waiting until FRA.
            Consider delaying to age 70 for maximum benefit (+
            {Math.round((70 - fra) * 8)}%).
          </p>
        </div>
      )}
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
