'use client'
// app/advisor/clients/[clientId]/_tabs/OverviewTab.tsx
// Advisor client snapshot — net worth, gap analysis, quick stats

import { ClientViewShellProps } from '../_client-view-shell'
import {
  formatCurrency, formatPct, getAge, getComplexityStyle,
  computeGaps, severityBadge, severityDot, type Gap
} from '../_utils'

export default function OverviewTab({ household, assets, realEstate, businesses, insurancePolicies, beneficiaries, estateDocuments }: ClientViewShellProps) {
  const currentYear = new Date().getFullYear()

  // ── Net worth calc ───────────────────────────────────────────────────────
  const totalBusinessValue = (businesses ?? []).reduce(
    (s, b) => s + (b.owner_estimated_value ?? b.estimated_value ?? 0),
    0,
  )
  const totalInsuranceEstate = (insurancePolicies ?? [])
    .filter(p => !p.is_ilit && p.death_benefit)
    .reduce((s, p) => s + (p.death_benefit ?? 0), 0)

  const totalAssets = [
    ...(assets ?? []).map(a => a.value ?? 0),
    ...(realEstate ?? []).map(r => r.current_value ?? 0),
    totalBusinessValue,
    totalInsuranceEstate,
  ].reduce((s, v) => s + v, 0)

  const totalLiabilities = [
    ...(realEstate ?? []).map(r => r.mortgage_balance ?? 0),
  ].reduce((s, v) => s + v, 0)

  const netWorth = totalAssets - totalLiabilities
  const assetPct = totalAssets > 0 ? Math.round((totalAssets / (totalAssets + totalLiabilities)) * 100) : 100

  // ── Asset breakdown ──────────────────────────────────────────────────────
  const assetGroups = groupAssets(assets ?? [], realEstate ?? [], totalBusinessValue, totalInsuranceEstate)

  // ── Gap analysis ─────────────────────────────────────────────────────────
  const gaps = computeGaps({ household, assets, realEstate, beneficiaries, estateDocuments })
  const criticalCount = gaps.filter(g => g.severity === 'critical').length
  const highCount = gaps.filter(g => g.severity === 'high').length

  // ── Allocation ───────────────────────────────────────────────────────────
  const stocks = household.target_stocks_pct ?? 0
  const bonds = household.target_bonds_pct ?? 0
  const cash = household.target_cash_pct ?? 0

  const p1Age = getAge(household.person1_birth_year, currentYear)
  const p2Age = household.has_spouse ? getAge(household.person2_birth_year, currentYear) : null

  return (
    <div className="space-y-6">

      {/* ── Gap alert banner ── */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className={`rounded-lg border px-5 py-4 flex items-start gap-3 ${
          criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
        }`}>
          <span className="text-xl mt-0.5">{criticalCount > 0 ? '⚠' : '!'}</span>
          <div>
            <p className={`font-semibold text-sm ${criticalCount > 0 ? 'text-red-800' : 'text-orange-800'}`}>
              {criticalCount > 0
                ? `${criticalCount} critical gap${criticalCount > 1 ? 's' : ''} require immediate attention`
                : `${highCount} high-priority gap${highCount > 1 ? 's' : ''} identified`}
            </p>
            <p className={`text-sm mt-0.5 ${criticalCount > 0 ? 'text-red-700' : 'text-orange-700'}`}>
              Review the gap analysis panel below and discuss with client at next meeting.
            </p>
          </div>
        </div>
      )}

      {/* ── Top stats row ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Net Worth" value={formatCurrency(netWorth, true)} sub={`${formatCurrency(totalAssets, true)} assets`} />
        <StatCard label="Estate Score" value={String(household.estate_complexity_score ?? '—')} sub={household.estate_complexity_flag ?? '—'} scoreFlag={household.estate_complexity_flag} />
        <StatCard label="Risk Tolerance" value={formatRisk(household.risk_tolerance)} sub={`${stocks}/${bonds}/${cash} target`} />
        <StatCard label="Planning Gaps" value={String(gaps.length)} sub={`${criticalCount} critical · ${highCount} high`} alert={criticalCount > 0} />
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* ── Net worth + asset breakdown ── */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Balance Sheet</h3>

            {/* Assets vs liabilities bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Assets</span>
                <span>Liabilities</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 rounded-l-full transition-all"
                  style={{ width: `${assetPct}%` }}
                />
                <div className="h-full bg-red-300 rounded-r-full flex-1" />
              </div>
              <div className="flex justify-between text-xs font-medium mt-1.5">
                <span className="text-emerald-700">{formatCurrency(totalAssets, true)}</span>
                <span className="text-red-600">{formatCurrency(totalLiabilities, true)}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-between">
              <span className="text-sm text-slate-500">Net Worth</span>
              <span className="text-sm font-bold text-slate-900">{formatCurrency(netWorth)}</span>
            </div>
          </div>

          {/* Asset breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Asset Breakdown</h3>
            <div className="space-y-2">
              {assetGroups.map(g => (
                <div key={g.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${g.color}`} />
                    <span className="text-sm text-slate-600">{g.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-800">{formatCurrency(g.value, true)}</span>
                    <span className="text-xs text-slate-400 ml-1">({Math.round((g.value / totalAssets) * 100)}%)</span>
                  </div>
                </div>
              ))}
              {assetGroups.length === 0 && <p className="text-sm text-slate-400">No asset data</p>}
            </div>
          </div>

          {/* Target allocation */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Target Allocation</h3>
            <div className="flex rounded-lg overflow-hidden h-4 mb-3">
              <div className="bg-indigo-500" style={{ width: `${stocks}%` }} title={`Stocks ${stocks}%`} />
              <div className="bg-sky-400" style={{ width: `${bonds}%` }} title={`Bonds ${bonds}%`} />
              <div className="bg-slate-300" style={{ width: `${cash}%` }} title={`Cash ${cash}%`} />
            </div>
            <div className="flex gap-4 text-xs text-slate-500">
              <span><span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1" />{stocks}% Stocks</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1" />{bonds}% Bonds</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1" />{cash}% Cash</span>
            </div>
          </div>

          {businesses && businesses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Business Interests</h3>
              <div className="space-y-3">
                {businesses.map((b) => (
                  <div key={b.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{b.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {b.entity_type ?? 'Business'} · {b.ownership_pct ? `${b.ownership_pct}% owned` : 'Ownership % not set'}
                      </p>
                      <div className="flex gap-2 mt-1.5">
                        {b.has_buy_sell_agreement ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">✓ Buy-sell</span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⚠ No buy-sell</span>
                        )}
                        {b.has_key_person_insurance && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">✓ Key person ins.</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatCurrency(b.owner_estimated_value ?? b.estimated_value ?? 0, true)}
                      </p>
                      <p className="text-xs text-slate-400">Your share</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insurancePolicies && insurancePolicies.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Insurance Policies</h3>
              <div className="space-y-3">
                {insurancePolicies.map((p) => (
                  <div key={p.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {p.policy_name || p.provider || 'Insurance Policy'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.insurance_type ?? 'Policy'}</p>
                      <div className="flex gap-2 mt-1.5">
                        {p.is_ilit ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">✓ ILIT</span>
                        ) : p.death_benefit ? (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⚠ Not in ILIT</span>
                        ) : null}
                        {p.is_employer_provided && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Employer</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {p.death_benefit && (
                        <>
                          <p className="text-sm font-semibold text-slate-800">{formatCurrency(p.death_benefit, true)}</p>
                          <p className="text-xs text-slate-400">Death benefit</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Gap analysis panel ── */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Planning Gap Analysis</h3>
              <span className="text-xs text-slate-400">{gaps.length} gap{gaps.length !== 1 ? 's' : ''} identified</span>
            </div>

            {gaps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <span className="text-3xl mb-2">✓</span>
                <p className="text-sm">No significant gaps identified</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gaps.map((gap, i) => (
                  <GapRow key={i} gap={gap} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Household details ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Household Profile</h3>
        <div className="grid grid-cols-4 gap-x-8 gap-y-3 text-sm">
          <Detail label="Primary" value={`${household.person1_first_name} ${household.person1_last_name}`} />
          <Detail label="Age" value={p1Age !== null ? String(p1Age) : '—'} />
          <Detail label="Retirement Age" value={household.person1_retirement_age ? String(household.person1_retirement_age) : '—'} />
          <Detail label="SS Claiming Age" value={household.person1_ss_claiming_age ? String(household.person1_ss_claiming_age) : 'Not set'} />

          {household.has_spouse && <>
            <Detail label="Spouse" value={`${household.person2_first_name} ${household.person2_last_name}`} />
            <Detail label="Age" value={p2Age !== null ? String(p2Age) : '—'} />
            <Detail label="Retirement Age" value={household.person2_retirement_age ? String(household.person2_retirement_age) : '—'} />
            <Detail label="SS Claiming Age" value={household.person2_ss_claiming_age ? String(household.person2_ss_claiming_age) : 'Not set'} />
          </>}

          <Detail label="State" value={household.state_primary ?? '—'} />
          <Detail label="Filing Status" value={formatFilingStatus(household.filing_status)} />
          <Detail label="Inflation Rate" value={household.inflation_rate ? `${household.inflation_rate}%` : '—'} />
          <Detail label="Growth (Accum.)" value={household.growth_rate_accumulation ? `${household.growth_rate_accumulation}%` : '—'} />
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, scoreFlag, alert }: {
  label: string; value: string; sub: string; scoreFlag?: string; alert?: boolean
}) {
  const { complexityColor } = getComplexityStyle(scoreFlag ?? null)
  return (
    <div className={`bg-white rounded-xl border p-5 ${alert ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-red-700' : scoreFlag ? complexityColor : 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5 capitalize">{sub}</p>
    </div>
  )
}

function GapRow({ gap }: { gap: Gap }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${severityDot(gap.severity)}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-slate-800">{gap.title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${severityBadge(gap.severity)}`}>
            {gap.severity}
          </span>
        </div>
        <p className="text-xs text-slate-500">{gap.detail}</p>
      </div>
      <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">{gap.category}</span>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatFilingStatus(status: string | null) {
  const map: Record<string, string> = {
    married_filing_jointly: 'Married Filing Jointly',
    married_filing_separately: 'MFS',
    single: 'Single',
    head_of_household: 'Head of HH',
  }
  return status ? (map[status] ?? status) : '—'
}

function groupAssets(assets: any[], realEstate: any[], totalBusinessValue: number, totalInsuranceEstate: number) {
  const groups: { label: string; value: number; color: string }[] = []

  const RETIREMENT_TYPES = ['401k', 'ira', 'roth_ira', 'sep_ira', '403b', '457', 'pension', 'retirement_account']
  const BROKERAGE_TYPES  = ['brokerage', 'taxable']
  const CASH_TYPES       = ['checking', 'savings', 'money_market', 'cd', 'cash']
  const INSURANCE_TYPES  = ['life_insurance', 'annuity']
  const EDUCATION_TYPES  = ['education_savings', '529']

  const getType = (a: any) => (a.type ?? a.account_type ?? '').toLowerCase()

  const retirement  = assets.filter(a => RETIREMENT_TYPES.includes(getType(a))).reduce((s, a) => s + (a.value ?? 0), 0)
  const brokerage   = assets.filter(a => BROKERAGE_TYPES.includes(getType(a))).reduce((s, a) => s + (a.value ?? 0), 0)
  const cash        = assets.filter(a => CASH_TYPES.includes(getType(a))).reduce((s, a) => s + (a.value ?? 0), 0)
  const insurance   = assets.filter(a => INSURANCE_TYPES.includes(getType(a))).reduce((s, a) => s + (a.value ?? 0), 0)
  const education   = assets.filter(a => EDUCATION_TYPES.includes(getType(a))).reduce((s, a) => s + (a.value ?? 0), 0)
  const other       = assets.filter(a => {
    const t = getType(a)
    return ![...RETIREMENT_TYPES, ...BROKERAGE_TYPES, ...CASH_TYPES, ...INSURANCE_TYPES, ...EDUCATION_TYPES].includes(t)
  }).reduce((s, a) => s + (a.value ?? 0), 0)

  const reValue = realEstate.reduce((s, r) => s + (r.current_value ?? 0), 0)

  if (reValue > 0)    groups.push({ label: 'Real Estate',      value: reValue,   color: 'bg-teal-500' })
  if (totalBusinessValue > 0) groups.push({ label: 'Business Interests', value: totalBusinessValue, color: 'bg-orange-500' })
  if (totalInsuranceEstate > 0) groups.push({ label: 'Life Insurance (Estate)', value: totalInsuranceEstate, color: 'bg-rose-400' })
  if (retirement > 0) groups.push({ label: 'Retirement Accts', value: retirement, color: 'bg-indigo-500' })
  if (brokerage > 0)  groups.push({ label: 'Brokerage',        value: brokerage,  color: 'bg-violet-400' })
  if (cash > 0)       groups.push({ label: 'Cash & Equiv.',    value: cash,       color: 'bg-emerald-400' })
  if (insurance > 0)  groups.push({ label: 'Life Insurance',   value: insurance,  color: 'bg-rose-400' })
  if (education > 0)  groups.push({ label: 'Education (529)',  value: education,  color: 'bg-amber-400' })
  if (other > 0)      groups.push({ label: 'Other Assets',     value: other,      color: 'bg-slate-400' })

  return groups.sort((a, b) => b.value - a.value)
}
