import { adjustSSForClaimingAge } from '@/lib/dashboard/calculations'

type IncomeRow = {
  amount: number | string | null
  source: string | null
  start_year: number | null
  end_year: number | null
}

type RealEstateRow = {
  mortgage_balance: number | string | null
  monthly_payment: number | string | null
}

type BuildIncomeSnapshotInput = {
  currentYear: number
  incomeRows: IncomeRow[]
  realEstateRows: RealEstateRow[]
  hasSpouse: boolean
  p1BirthYear: number | null
  p1SSClaimingAge: number | null
  p1SSPia: number | null
  p2BirthYear: number | null
  p2SSClaimingAge: number | null
  p2SSPia: number | null
  expensesTotal: number
}

export function buildIncomeSnapshot(input: BuildIncomeSnapshotInput) {
  const totalIncomeFromTable = input.incomeRows.reduce((sum, row) => {
    if (row.start_year && row.start_year > input.currentYear) return sum
    if (row.end_year && row.end_year < input.currentYear) return sum
    return sum + Number(row.amount)
  }, 0)

  const hasSSInIncomeTable = input.incomeRows.some((row) => row.source === 'social_security')

  const p1MonthlyBenefit =
    input.p1SSPia && input.p1SSClaimingAge && input.p1BirthYear
      ? adjustSSForClaimingAge(input.p1SSPia, input.p1SSClaimingAge, input.p1BirthYear)
      : (input.p1SSPia ?? null)

  const p2MonthlyBenefit =
    input.hasSpouse && input.p2SSPia && input.p2SSClaimingAge && input.p2BirthYear
      ? adjustSSForClaimingAge(input.p2SSPia, input.p2SSClaimingAge, input.p2BirthYear)
      : input.hasSpouse
        ? (input.p2SSPia ?? null)
        : null

  const combinedSSMonthly = (p1MonthlyBenefit ?? 0) + (p2MonthlyBenefit ?? 0)

  const p1CurrentAge = input.p1BirthYear ? input.currentYear - input.p1BirthYear : null
  const p2CurrentAge = input.p2BirthYear ? input.currentYear - input.p2BirthYear : null
  const p1IsClaimingNow =
    p1CurrentAge !== null &&
    input.p1SSClaimingAge !== null &&
    p1CurrentAge >= input.p1SSClaimingAge
  const p2IsClaimingNow =
    input.hasSpouse &&
    p2CurrentAge !== null &&
    input.p2SSClaimingAge !== null &&
    p2CurrentAge >= input.p2SSClaimingAge

  const annualSSFromPIA =
    ((p1IsClaimingNow ? (p1MonthlyBenefit ?? 0) : 0) +
      (p2IsClaimingNow ? (p2MonthlyBenefit ?? 0) : 0)) * 12

  const totalIncome = hasSSInIncomeTable
    ? totalIncomeFromTable
    : totalIncomeFromTable + annualSSFromPIA

  const annualMortgagePayments = input.realEstateRows
    .filter(
      (row) =>
        Number(row.mortgage_balance ?? 0) > 0 &&
        Number(row.monthly_payment ?? 0) > 0,
    )
    .reduce((sum, row) => sum + Number(row.monthly_payment) * 12, 0)

  const totalMortgageBalance = input.realEstateRows.reduce(
    (sum, row) => sum + Number(row.mortgage_balance ?? 0),
    0,
  )

  const totalExpenses = input.expensesTotal + annualMortgagePayments
  const savingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0
  const currentYearNet = totalIncome - totalExpenses

  return {
    totalIncome,
    totalExpenses,
    savingsRate,
    currentYearNet,
    annualSSFromPIA,
    totalMortgageBalance,
    combinedSSMonthly: combinedSSMonthly > 0 ? combinedSSMonthly : null,
    p1MonthlyBenefit,
    p2MonthlyBenefit,
  }
}
