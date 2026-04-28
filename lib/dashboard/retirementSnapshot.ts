import type { YearRow } from '@/lib/calculations/projection-complete'

export function computeYearsToRetirement(
  currentYear: number,
  birthYear: number | null,
  retirementAge: number | null,
): number | null {
  const currentAge = birthYear ? currentYear - birthYear : null
  if (!retirementAge || !currentAge) return null
  return Math.max(0, retirementAge - currentAge)
}

export function getRetirementIncomeProjection(
  baseCaseRows: YearRow[],
  p1BirthYear: number | null,
  p1RetirementAge: number | null,
  totalExpenses: number,
): {
  projectedAnnualIncome: number | null
  projectedAnnualExpenses: number | null
  projectedIncomeGap: number | null
} {
  let projectedAnnualIncome: number | null = null
  let projectedAnnualExpenses: number | null = null
  let projectedIncomeGap: number | null = null

  if (baseCaseRows.length > 0 && p1BirthYear && p1RetirementAge) {
    const retirementYear = p1BirthYear + p1RetirementAge
    const firstFullRetirementYear = retirementYear + 1
    const retirementRow =
      baseCaseRows.find((r) => r.year === firstFullRetirementYear) ??
      baseCaseRows.find((r) => r.year === retirementYear) ??
      baseCaseRows.find((r) => (r.age_person1 ?? 0) >= p1RetirementAge)

    if (retirementRow) {
      projectedAnnualIncome = retirementRow.income_total ?? 0
      projectedAnnualExpenses = retirementRow.expenses_total ?? totalExpenses
      projectedIncomeGap = projectedAnnualIncome - projectedAnnualExpenses
    }
  }

  return {
    projectedAnnualIncome,
    projectedAnnualExpenses,
    projectedIncomeGap,
  }
}
