export type RetirementSnapshotViewModel = {
  p1Name: string | null
  p1RetirementAge: number | null
  p1SSClaimingAge: number | null
  p1MonthlyBenefit: number | null
  p1BirthYear: number | null
  p2Name: string | null
  p2RetirementAge: number | null
  p2SSClaimingAge: number | null
  p2MonthlyBenefit: number | null
  hasSpouse: boolean
  yearsToRetirement: number | null
  combinedSSMonthly: number | null
  projectedAnnualIncome: number | null
  projectedAnnualExpenses: number | null
  projectedIncomeGap: number | null
}

type BuildRetirementSnapshotInput = {
  hasRetirementInputs: boolean
  hasSpouse: boolean
  p1Name: string | null
  p1RetirementAge: number | null
  p1SSClaimingAge: number | null
  p1MonthlyBenefit: number | null
  p1BirthYear: number | null
  p2Name: string | null
  p2RetirementAge: number | null
  p2SSClaimingAge: number | null
  p2MonthlyBenefit: number | null
  yearsToRetirement: number | null
  combinedSSMonthly: number | null
  projectedAnnualIncome: number | null
  projectedAnnualExpenses: number | null
  projectedIncomeGap: number | null
}

export function buildRetirementSnapshot(
  input: BuildRetirementSnapshotInput,
): RetirementSnapshotViewModel | null {
  if (!input.hasRetirementInputs) return null

  return {
    p1Name: input.p1Name,
    p1RetirementAge: input.p1RetirementAge,
    p1SSClaimingAge: input.p1SSClaimingAge,
    p1MonthlyBenefit: input.p1MonthlyBenefit,
    p1BirthYear: input.p1BirthYear,
    p2Name: input.hasSpouse ? input.p2Name : null,
    p2RetirementAge: input.hasSpouse ? input.p2RetirementAge : null,
    p2SSClaimingAge: input.hasSpouse ? input.p2SSClaimingAge : null,
    p2MonthlyBenefit: input.hasSpouse ? input.p2MonthlyBenefit : null,
    hasSpouse: input.hasSpouse,
    yearsToRetirement: input.yearsToRetirement,
    combinedSSMonthly: input.combinedSSMonthly,
    projectedAnnualIncome: input.projectedAnnualIncome,
    projectedAnnualExpenses: input.projectedAnnualExpenses,
    projectedIncomeGap: input.projectedIncomeGap,
  }
}
