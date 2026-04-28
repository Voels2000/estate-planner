type FinancialLikeProps = {
  totalAssets: number
  totalIncome: number
}

type RetirementLikeProps = {
  retirementSnapshot: {
    p1RetirementAge: number | null
    p1MonthlyBenefit: number | null
    p2MonthlyBenefit: number | null
  } | null
}

type EstateLikeProps = {
  totalAssets: number
}

export function hasFinancialData(props: FinancialLikeProps) {
  return props.totalAssets > 0 || props.totalIncome > 0
}

export function hasRetirementData(props: RetirementLikeProps) {
  const snapshot = props.retirementSnapshot
  if (!snapshot) return false
  return !!(snapshot.p1RetirementAge || snapshot.p1MonthlyBenefit || snapshot.p2MonthlyBenefit)
}

export function hasEstateData(props: EstateLikeProps) {
  return props.totalAssets > 0
}
