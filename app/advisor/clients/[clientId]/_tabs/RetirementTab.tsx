'use client'

/**
 * Advisor Retirement tab: Social Security timing, RMD context, retirement account
 * composition, and plan-level retirement assumptions.
 */

import type { SocialSecurityData } from '@/lib/social-security/loadSocialSecurityData'
import { getSsBenefitFromPia, getFraFromBirthYear } from '@/lib/calculations/projection-complete'
import { getRmdStartAge } from '@/lib/calculations/rmdStartAge'
import { ClientViewShellProps } from '../_client-view-shell'
import { formatCurrency, getAge } from '../_utils'

type RetirementAssetRow = {
  id: string
  type?: string | null
  account_type?: string | null
  value?: number | null
  owner?: string | null
}

const TAX_DEFERRED_TYPES = new Set([
  'traditional_ira',
  'traditional_401k',
  'traditional_403b',
  '401k',
  '403b',
  'ira',
  'rollover_ira',
  'sep_ira',
  'simple_ira',
  '457',
  'pension',
  'retirement_account',
])

const ROTH_TYPES = new Set(['roth_ira', 'roth_401k', 'roth_403b', 'roth'])

export default function RetirementTab({
  household,
  assets,
  scenarioOutputs = [],
  advisorSsData,
  advisorRothData,
}: ClientViewShellProps) {
  const currentYear = new Date().getFullYear()
  const p1Name = household.person1_first_name ?? 'Person 1'
  const p2Name = household.person2_first_name ?? 'Person 2'
  const hasSpouse = household.has_spouse ?? false

  const person1BirthYear = typeof household.person1_birth_year === 'number' ? household.person1_birth_year : null
  const person2BirthYear = typeof household.person2_birth_year === 'number' ? household.person2_birth_year : null
  const p1Age = getAge(person1BirthYear, currentYear) ?? 0
  const p2Age = hasSpouse ? (getAge(person2BirthYear, currentYear) ?? 0) : null

  const p1RetirementAge = household.person1_retirement_age ?? 67
  const p2RetirementAge = household.person2_retirement_age ?? 67
  const p1RetirementYear = (person1BirthYear ?? 1960) + p1RetirementAge
  const yearsToRetirement = Math.max(0, p1RetirementYear - currentYear)
  const p1LongevityAge = household.person1_longevity_age ?? 90

  const retirementRow = scenarioOutputs.find((r) => r.year === p1RetirementYear)
  const netWorthAtRetirement = retirementRow?.net_worth ?? null
  const lastRow = scenarioOutputs.length > 0 ? scenarioOutputs[scenarioOutputs.length - 1] : null
  const fundsOutlastLifetime =
    scenarioOutputs.length > 0 ? (lastRow?.net_worth ?? 0) > 0 : null

  const incomeAtRetirement = retirementRow?.income_total ?? null
  const expensesAtRetirement = retirementRow?.expenses_total ?? null
  const retirementIncomeGap =
    incomeAtRetirement != null && expensesAtRetirement != null
      ? incomeAtRetirement - expensesAtRetirement
      : null

  const accountType = (a: { type?: string | null; account_type?: string | null }) =>
    (a.type ?? a.account_type ?? '').toLowerCase()

  const assetRows = (assets ?? []) as RetirementAssetRow[]
  const retirementAssets = assetRows.filter((a) => {
    const raw = accountType(a)
    return TAX_DEFERRED_TYPES.has(raw) || ROTH_TYPES.has(raw)
  })
  const traditionalAssets = retirementAssets.filter((a) => !ROTH_TYPES.has(accountType(a)))
  const rothAssets = retirementAssets.filter((a) => ROTH_TYPES.has(accountType(a)))
  const totalTraditional = traditionalAssets.reduce((s, a) => s + Number(a.value ?? 0), 0)
  const totalRoth = rothAssets.reduce((s, a) => s + Number(a.value ?? 0), 0)
  const totalRetirement = totalTraditional + totalRoth
  const rothPct = totalRetirement > 0 ? (totalRoth / totalRetirement) * 100 : 0

  const p1RmdAge = person1BirthYear != null ? getRmdStartAge(person1BirthYear) : 75
  const p2RmdAge =
    hasSpouse && person2BirthYear != null ? getRmdStartAge(person2BirthYear) : null
  const p1YearsToRMD = Math.max(0, p1RmdAge - p1Age)
  const p2YearsToRMD = p2Age !== null && p2RmdAge != null ? Math.max(0, p2RmdAge - p2Age) : null
  const hasRMDExposure =
    totalTraditional > 0 && (p1YearsToRMD <= 10 || (p2YearsToRMD !== null && p2YearsToRMD <= 10))
  const rothConversionOpportunity = totalTraditional > 250_000 && rothPct < 30

  const p1TraditionalBalance = retirementAssets
    .filter((a) => a.owner === 'person1' && !ROTH_TYPES.has(accountType(a)))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)
  const p2TraditionalBalance = retirementAssets
    .filter((a) => a.owner === 'person2' && !ROTH_TYPES.has(accountType(a)))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)

  const taxableBrokerageTotal = assetRows
    .filter((a) => ['taxable_brokerage', 'brokerage'].includes(accountType(a)))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)

  const p1Ss = advisorSsData?.person1
  const p2Ss = advisorSsData?.person2
  const survivorBenefit = p2Ss?.survivorBenefit ?? null
  const breakevenAge = p1Ss ? computeBreakevenAge(p1Ss) : null

  const rothWindow = advisorRothData?.optimalConversionWindow

  return (
    <div className="space-y-5 pb-12">
      {hasRMDExposure && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">RMD Planning Window</p>
          <p className="text-sm text-amber-700 mt-0.5">
            {p1YearsToRMD <= 10 &&
              `${p1Name} begins RMDs in ${p1YearsToRMD} year${p1YearsToRMD !== 1 ? 's' : ''} (age ${p1RmdAge}). `}
            {p2YearsToRMD !== null &&
              p2YearsToRMD <= 10 &&
              `${p2Name} begins RMDs in ${p2YearsToRMD} year${p2YearsToRMD !== 1 ? 's' : ''} (age ${p2RmdAge}). `}
            {formatCurrency(totalTraditional, true)} in traditional retirement accounts subject to RMD.
            {rothConversionOpportunity && ' Consider Roth conversion strategy before RMD onset.'}
          </p>
        </div>
      )}

      {fundsOutlastLifetime !== null && (
        <div
          className={[
            'rounded-lg border-2 p-4',
            fundsOutlastLifetime ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50',
          ].join(' ')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className={`text-sm font-medium mb-1 ${fundsOutlastLifetime ? 'text-emerald-800' : 'text-red-800'}`}
              >
                {fundsOutlastLifetime
                  ? 'Funds outlast lifetime — on track'
                  : 'Funds may not outlast lifetime — review needed'}
              </p>
              <p
                className={`text-xs leading-relaxed ${fundsOutlastLifetime ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {p1Name} retires at {p1RetirementAge} (
                {yearsToRetirement > 0 ? `${yearsToRetirement} years away` : 'already retired'})
                {hasSpouse ? ` · ${p2Name} retires at ${p2RetirementAge}` : ''}
                {p1LongevityAge ? ` · Projected to age ${p1LongevityAge}` : ''}
              </p>
            </div>
            {netWorthAtRetirement != null && (
              <div className="text-right ml-4 flex-shrink-0">
                <p
                  className={`text-xl font-medium ${fundsOutlastLifetime ? 'text-emerald-800' : 'text-red-800'}`}
                >
                  {formatCurrency(netWorthAtRetirement)}
                </p>
                <p className={`text-xs ${fundsOutlastLifetime ? 'text-emerald-700' : 'text-red-700'}`}>
                  Net worth at retirement
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {(incomeAtRetirement != null || netWorthAtRetirement != null) && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-3">
            Retirement snapshot — year {p1RetirementYear}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Net worth at retirement',
                val: netWorthAtRetirement,
                green: true,
              },
              { label: 'Projected annual income', val: incomeAtRetirement },
              { label: 'Projected expenses', val: expensesAtRetirement },
              {
                label: 'Annual surplus/deficit',
                val: retirementIncomeGap,
                green: retirementIncomeGap != null && retirementIncomeGap >= 0,
                red: retirementIncomeGap != null && retirementIncomeGap < 0,
              },
            ]
              .filter((tile) => tile.val != null)
              .map((tile) => (
                <div key={tile.label} className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 mb-1">{tile.label}</p>
                  <p
                    className={`text-base font-medium ${
                      tile.green ? 'text-emerald-700' : tile.red ? 'text-red-600' : 'text-neutral-800'
                    }`}
                  >
                    {Number(tile.val) < 0 ? '-' : ''}
                    {formatCurrency(Math.abs(Number(tile.val)))}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1">Total retirement</p>
          <p className="text-xl font-medium text-neutral-800">{formatCurrency(totalRetirement, true)}</p>
          <p className="text-xs text-neutral-400 mt-1">{retirementAssets.length} accounts</p>
        </div>
        <div
          className={`rounded-lg border p-4 ${
            totalTraditional > 500_000 ? 'border-amber-200 bg-amber-50' : 'border-neutral-200 bg-white'
          }`}
        >
          <p
            className={`text-[10px] uppercase tracking-wide mb-1 ${
              totalTraditional > 500_000 ? 'text-amber-600' : 'text-neutral-400'
            }`}
          >
            Traditional / pre-tax
          </p>
          <p
            className={`text-xl font-medium ${
              totalTraditional > 500_000 ? 'text-amber-700' : 'text-neutral-800'
            }`}
          >
            {formatCurrency(totalTraditional, true)}
          </p>
          <p
            className={`text-xs mt-1 ${
              totalTraditional > 500_000 ? 'text-amber-600' : 'text-neutral-400'
            }`}
          >
            Subject to RMD
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1">Roth / after-tax</p>
          <p className="text-xl font-medium text-neutral-800">{formatCurrency(totalRoth, true)}</p>
          <p className="text-xs text-neutral-400 mt-1">
            {totalRetirement > 0 ? Math.round(rothPct) : 0}% of retirement
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium text-neutral-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-500 rounded-full inline-block" />
            Social Security
          </p>

          {[
            {
              name: p1Name,
              pia: Number(household.person1_ss_pia ?? 0),
              claimAge: household.person1_ss_claiming_age,
              birthYear: person1BirthYear ?? 1960,
              electedMonthly: p1Ss?.electedMonthly,
            },
            ...(hasSpouse
              ? [
                  {
                    name: p2Name,
                    pia: Number(household.person2_ss_pia ?? 0),
                    claimAge: household.person2_ss_claiming_age,
                    birthYear: person2BirthYear ?? 1960,
                    electedMonthly: p2Ss?.electedMonthly,
                  },
                ]
              : []),
          ].map((person) => {
            const fra = getFraFromBirthYear(person.birthYear)
            const claimAge = person.claimAge ?? fra
            const computedMonthly =
              person.electedMonthly ??
              (person.pia > 0
                ? Math.round(getSsBenefitFromPia(person.pia, claimAge, person.birthYear) / 12)
                : null)
            const isDelayed = claimAge > fra
            const isEarly = claimAge < fra

            return (
              <div key={person.name} className="mb-3 last:mb-0 rounded-md bg-neutral-50 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-neutral-700">{person.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      PIA (FRA): {person.pia > 0 ? `${formatCurrency(person.pia)}/mo` : '—'}
                      {' · '}
                      Claiming at: {claimAge}
                      {isDelayed && (
                        <span className="ml-1 text-emerald-600 font-medium">▲ Delayed vs FRA</span>
                      )}
                      {isEarly && <span className="ml-1 text-amber-600 font-medium">▼ Early claim</span>}
                    </p>
                  </div>
                  {computedMonthly != null && computedMonthly > 0 && (
                    <p className="text-sm font-medium text-neutral-800">
                      {formatCurrency(computedMonthly)}/mo
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {(survivorBenefit != null || breakevenAge != null) && (
            <div className="mt-3 border-t border-neutral-100 pt-3 space-y-2">
              {survivorBenefit != null && (
                <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                  <p className="text-[10px] text-blue-600 mb-0.5">Survivor benefit</p>
                  <p className="text-sm font-medium text-blue-700">{formatCurrency(survivorBenefit)}/mo</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    {p2Name} receives the higher of both benefits if {p1Name} predeceases
                  </p>
                </div>
              )}
              {breakevenAge != null && (
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <p className="text-[10px] text-neutral-500 mb-0.5">Breakeven age</p>
                  <p className="text-sm font-medium text-neutral-700">Age {breakevenAge}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    Delay strategy pays off if {p1Name} lives past {breakevenAge}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium text-neutral-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full inline-block" />
            RMD timeline
          </p>

          {[
            {
              name: p1Name,
              age: p1Age,
              yearsToRmd: p1YearsToRMD,
              rmdStartAge: p1RmdAge,
              balance: p1TraditionalBalance,
            },
            ...(hasSpouse && p2Age != null && p2YearsToRMD != null
              ? [
                  {
                    name: p2Name,
                    age: p2Age,
                    yearsToRmd: p2YearsToRMD,
                    rmdStartAge: p2RmdAge ?? 75,
                    balance: p2TraditionalBalance,
                  },
                ]
              : []),
          ].map((person) => (
            <div key={person.name} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-neutral-700">
                  {person.name}, age {person.age}
                </p>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    person.yearsToRmd === 0
                      ? 'bg-red-100 text-red-700'
                      : person.yearsToRmd <= 5
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {person.yearsToRmd === 0 ? 'RMD active' : `${person.yearsToRmd}yr to RMD`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full ${person.yearsToRmd <= 3 ? 'bg-amber-400' : 'bg-blue-400'}`}
                  style={{
                    width: `${Math.min(100, Math.max(5, 100 - (person.yearsToRmd / 20) * 100))}%`,
                  }}
                />
              </div>
              {person.balance > 0 && (
                <p className="text-[10px] text-neutral-400">
                  Pre-tax balance: {formatCurrency(person.balance, true)}
                </p>
              )}
            </div>
          ))}

          {(advisorRothData != null && (advisorRothData.totalConversions > 0 || rothConversionOpportunity)) && (
            <div className="mt-3 border-t border-neutral-100 pt-3 rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-[10px] font-medium text-amber-700 mb-1">Roth conversion opportunity</p>
              {advisorRothData.totalConversions > 0 && rothWindow ? (
                <p className="text-[11px] text-amber-600 leading-relaxed">
                  Optimal conversion window: {rothWindow.startYear}–{rothWindow.endYear}. Converting{' '}
                  {formatCurrency(advisorRothData.totalConversions)} could save{' '}
                  {formatCurrency(advisorRothData.totalLifetimeTaxSavings)} in lifetime taxes.
                </p>
              ) : (
                <p className="text-[11px] text-amber-600 leading-relaxed">
                  {Math.round(rothPct)}% of retirement assets are in Roth accounts. With{' '}
                  {formatCurrency(totalTraditional, true)} in pre-tax accounts, a systematic Roth conversion
                  strategy before RMD onset may reduce lifetime tax burden.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-3">
          Tax-efficient withdrawal sequencing
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              step: 1,
              label: 'Taxable accounts first',
              desc: 'Harvest gains at favorable rates. Preserves tax-deferred compounding.',
              pct:
                totalRetirement + taxableBrokerageTotal > 0
                  ? Math.round((taxableBrokerageTotal / (totalRetirement + taxableBrokerageTotal)) * 100)
                  : 0,
              color: 'bg-blue-50 border-blue-100',
              textColor: 'text-blue-800',
            },
            {
              step: 2,
              label: 'Traditional / pre-tax',
              desc: 'Draw down before RMDs begin to reduce future mandatory distributions.',
              pct: totalRetirement > 0 ? Math.round((totalTraditional / totalRetirement) * 100) : 0,
              color: 'bg-amber-50 border-amber-100',
              textColor: 'text-amber-800',
            },
            {
              step: 3,
              label: 'Roth / after-tax last',
              desc: 'Tax-free growth indefinitely. No RMDs. Leave for heirs or late-life needs.',
              pct: totalRetirement > 0 ? Math.round((totalRoth / totalRetirement) * 100) : 0,
              color: 'bg-emerald-50 border-emerald-100',
              textColor: 'text-emerald-800',
            },
          ].map((item) => (
            <div key={item.step} className={`rounded-lg border p-3 ${item.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium bg-white border ${item.color}`}
                >
                  <span className={item.textColor}>{item.step}</span>
                </div>
                <p className={`text-xs font-medium ${item.textColor}`}>{item.label}</p>
              </div>
              <p className={`text-[11px] leading-relaxed mb-2 ${item.textColor} opacity-80`}>{item.desc}</p>
              <p className={`text-xs font-medium ${item.textColor}`}>{item.pct}% of retirement assets</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-[color:var(--mwm-navy)] mb-4">Planning Assumptions</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
          <Assumption
            label="Inflation Rate"
            value={household.inflation_rate ? `${household.inflation_rate}%` : '—'}
          />
          <Assumption
            label="Growth (Accumulation)"
            value={household.growth_rate_accumulation ? `${household.growth_rate_accumulation}%` : '—'}
          />
          <Assumption
            label="Growth (Retirement)"
            value={household.growth_rate_retirement ? `${household.growth_rate_retirement}%` : '—'}
          />
          <Assumption label="Risk Tolerance" value={formatRisk(household.risk_tolerance ?? null)} />
          <Assumption
            label={`${p1Name} Retirement Age`}
            value={household.person1_retirement_age ? String(household.person1_retirement_age) : 'Not set'}
          />
          <Assumption
            label={`${p1Name} Longevity`}
            value={household.person1_longevity_age ? String(household.person1_longevity_age) : 'Not set'}
          />
          {hasSpouse && (
            <>
              <Assumption
                label={`${p2Name} Retirement Age`}
                value={household.person2_retirement_age ? String(household.person2_retirement_age) : 'Not set'}
              />
              <Assumption
                label={`${p2Name} Longevity`}
                value={household.person2_longevity_age ? String(household.person2_longevity_age) : 'Not set'}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function computeBreakevenAge(person: SocialSecurityData['person1']): number {
  const electedScenario = person.scenarios.find((s) => s.age === person.electedAge)
  const fraScenario = person.scenarios.find((s) => s.age === Math.round(person.fra))
  let breakevenAge = person.electedAge + 12

  if (electedScenario && fraScenario) {
    for (const point of electedScenario.cumulativeByAge) {
      const fraPoint = fraScenario.cumulativeByAge.find((x) => x.age === point.age)
      if (fraPoint && point.cumulative > fraPoint.cumulative) {
        breakevenAge = point.age
        break
      }
    }
  }

  return breakevenAge
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
    conservative: 'Conservative',
    moderately_conservative: 'Mod. Conservative',
    moderate: 'Moderate',
    moderately_aggressive: 'Mod. Aggressive',
    aggressive: 'Aggressive',
  }
  return r ? (map[r] ?? r) : '—'
}
