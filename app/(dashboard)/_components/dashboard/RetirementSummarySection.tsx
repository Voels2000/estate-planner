import { CollapsibleSection } from '@/components/CollapsibleSection'
import { firstName, fmt } from '@/app/(dashboard)/_components/dashboard/formatters'
import { StatBox } from '@/app/(dashboard)/_components/dashboard/ui-primitives'
import { hasRetirementData } from '@/app/(dashboard)/_components/dashboard/state-helpers'

type RetirementSnapshot = {
  p1Name: string | null
  p1RetirementAge: number | null
  p1SSClaimingAge: number | null
  p1MonthlyBenefit: number | null
  p2Name: string | null
  p2SSClaimingAge: number | null
  p2MonthlyBenefit: number | null
  hasSpouse: boolean
  yearsToRetirement: number | null
  combinedSSMonthly: number | null
  projectedAnnualIncome: number | null
  projectedIncomeGap: number | null
}

type RmdStatus = {
  p1Name: string
  p2Name: string | null
  p1Required: number
  p1Planned: number
  p1StartYear: number | null
  p2Required: number
  p2Planned: number
  p2StartYear: number | null
  hasSpouse: boolean
} | null

type RetirementSummarySectionProps = {
  storageKey: string
  retirementSnapshot: RetirementSnapshot | null
  currentYearNet: number
  annualSSFromPIA: number
  totalIncome: number
  totalExpenses: number
  rmdStatus: RmdStatus
}

export function RetirementSummarySection(props: RetirementSummarySectionProps) {
  const { retirementSnapshot, currentYearNet, annualSSFromPIA, totalIncome, totalExpenses, rmdStatus } = props
  const hasData = hasRetirementData({ retirementSnapshot })
  const nonSSIncome = totalIncome - annualSSFromPIA

  return (
    <CollapsibleSection
      title="Retirement Summary"
      subtitle={
        hasData && retirementSnapshot
          ? [
              retirementSnapshot.p1RetirementAge ? `Retire at ${retirementSnapshot.p1RetirementAge}` : null,
              retirementSnapshot.yearsToRetirement !== null ? `${retirementSnapshot.yearsToRetirement} years away` : null,
              retirementSnapshot.combinedSSMonthly ? `SS ${fmt(retirementSnapshot.combinedSSMonthly)}/mo combined` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Complete your profile to see your retirement snapshot'
      }
      defaultOpen={false}
      storageKey={props.storageKey}
      locked={!hasData}
      lockedMessage="Add your retirement age and Social Security PIA on your profile page to see your retirement snapshot."
      lockedHref="/profile"
      lockedHrefLabel="Complete your profile"
    >
      {retirementSnapshot && (
        <div className="space-y-5">
          <div className={`rounded-xl border px-5 py-4 ${currentYearNet >= 0 ? 'border-emerald-100 bg-emerald-50' : 'border-red-100 bg-red-50'}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Current Year — Income vs Expenses</p>
                <div className="flex items-end gap-2">
                  <p className={`text-3xl font-bold ${currentYearNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {currentYearNet >= 0 ? '+' : ''}
                    {fmt(currentYearNet)}
                  </p>
                  <p className={`text-sm mb-1 ${currentYearNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {currentYearNet >= 0 ? 'annual surplus' : 'annual shortfall'}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-neutral-500 space-y-1 shrink-0">
                {nonSSIncome > 0 && (
                  <p>
                    Other income: <span className="font-semibold text-neutral-700">{fmt(nonSSIncome)}</span>
                  </p>
                )}
                {annualSSFromPIA > 0 && (
                  <p>
                    SS income: <span className="font-semibold text-neutral-700">{fmt(annualSSFromPIA)}</span>
                  </p>
                )}
                <p>
                  Expenses: <span className="font-semibold text-red-600">− {fmt(totalExpenses)}</span>
                </p>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 mt-2">Updates automatically as your income and expense data changes.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Retirement Age"
              value={retirementSnapshot.p1RetirementAge?.toString() ?? '—'}
              sub={retirementSnapshot.yearsToRetirement !== null ? `${retirementSnapshot.yearsToRetirement} years away` : undefined}
            />
            <StatBox label="Years to Retirement" value={retirementSnapshot.yearsToRetirement?.toString() ?? '—'} />
            {retirementSnapshot.projectedAnnualIncome !== null ? (
              <StatBox
                label="Projected Income at Retirement"
                value={fmt(retirementSnapshot.projectedAnnualIncome)}
                sub="SS + RMD + other"
                highlight={retirementSnapshot.projectedIncomeGap !== null && retirementSnapshot.projectedIncomeGap >= 0 ? 'green' : undefined}
              />
            ) : (
              <StatBox
                label="Combined SS / mo"
                value={retirementSnapshot.combinedSSMonthly ? fmt(retirementSnapshot.combinedSSMonthly) : '—'}
                sub="at claiming age"
              />
            )}
            {retirementSnapshot.projectedIncomeGap !== null ? (
              <StatBox
                label={retirementSnapshot.projectedIncomeGap >= 0 ? 'Retirement Surplus / yr' : 'Retirement Gap / yr'}
                value={fmt(Math.abs(retirementSnapshot.projectedIncomeGap))}
                sub={retirementSnapshot.projectedIncomeGap >= 0 ? 'projected surplus' : 'projected shortfall'}
                highlight={retirementSnapshot.projectedIncomeGap >= 0 ? 'green' : 'red'}
              />
            ) : (
              <StatBox label="Annual Expenses" value={fmt(totalExpenses)} sub="current" />
            )}
          </div>

          {(retirementSnapshot.p1MonthlyBenefit || retirementSnapshot.p2MonthlyBenefit) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Social Security by Person</p>
              <div className={`grid gap-3 ${retirementSnapshot.hasSpouse && retirementSnapshot.p2MonthlyBenefit ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
                {retirementSnapshot.p1MonthlyBenefit && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <p className="text-xs text-blue-500 mb-1">{firstName(retirementSnapshot.p1Name) || 'You'}</p>
                    <p className="text-lg font-bold text-blue-800">
                      {fmt(retirementSnapshot.p1MonthlyBenefit)}
                      <span className="text-xs font-normal text-blue-500">/mo</span>
                    </p>
                    {retirementSnapshot.p1SSClaimingAge && <p className="text-[10px] text-blue-400 mt-0.5">claiming at {retirementSnapshot.p1SSClaimingAge}</p>}
                  </div>
                )}
                {retirementSnapshot.hasSpouse && retirementSnapshot.p2MonthlyBenefit && (
                  <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                    <p className="text-xs text-violet-500 mb-1">{firstName(retirementSnapshot.p2Name) || 'Spouse'}</p>
                    <p className="text-lg font-bold text-violet-800">
                      {fmt(retirementSnapshot.p2MonthlyBenefit)}
                      <span className="text-xs font-normal text-violet-500">/mo</span>
                    </p>
                    {retirementSnapshot.p2SSClaimingAge && <p className="text-[10px] text-violet-400 mt-0.5">claiming at {retirementSnapshot.p2SSClaimingAge}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {rmdStatus && (rmdStatus.p1Required > 0 || rmdStatus.p2Required > 0 || true) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">Required Minimum Distributions — {new Date().getFullYear()}</p>
              <div className="space-y-2">
                {[
                  {
                    name: rmdStatus.p1Name,
                    required: rmdStatus.p1Required,
                    planned: rmdStatus.p1Planned,
                    startYear: rmdStatus.p1StartYear,
                  },
                  ...(rmdStatus.hasSpouse
                    ? [
                        {
                          name: rmdStatus.p2Name ?? 'Person 2',
                          required: rmdStatus.p2Required,
                          planned: rmdStatus.p2Planned,
                          startYear: rmdStatus.p2StartYear,
                        },
                      ]
                    : []),
                ].map((person) => (
                  <div key={person.name} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                    <span className="text-sm font-medium text-neutral-700">{person.name}</span>
                    {person.required === 0 ? (
                      <span className="text-xs text-neutral-400">Not required until {person.startYear ?? '—'}</span>
                    ) : person.planned >= person.required ? (
                      <span className="text-xs text-green-600 font-medium">{fmt(person.required)} required · ✓ Met</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">
                        {fmt(person.required)} required · ⚠ {fmt(person.required - person.planned)} remaining
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {retirementSnapshot.projectedIncomeGap !== null && retirementSnapshot.projectedIncomeGap < 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 flex items-start gap-3">
              <span className="text-red-500 text-lg mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-semibold text-red-800">Projected Retirement Income Gap</p>
                <p className="text-xs text-red-600 mt-0.5">
                  At retirement your projected income falls short of expenses by {fmt(Math.abs(retirementSnapshot.projectedIncomeGap))} per year. Review your retirement income plan.
                </p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-neutral-400">
            SS adjusted for claiming age vs full retirement age. Projected income shown for the first full year after retirement — the transition year itself blends working and retired income and is excluded. If you retire early in the year, your actual first-year income may be higher. Use the Lifetime Snapshot for a year-by-year view.
          </p>
        </div>
      )}
    </CollapsibleSection>
  )
}
