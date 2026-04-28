import type {
  HouseholdProjectionProfile,
  ProjectionApiRow,
  ProjectionYear,
} from '@/lib/projections/types'

export function mapProjectionRows(
  rows: ProjectionApiRow[],
  household: HouseholdProjectionProfile,
): ProjectionYear[] {
  return rows.map((r) => ({
    age: r.age_person1,
    year: r.year,
    income: r.income_total,
    expenses: r.expenses_total,
    taxes: r.tax_total,
    net: r.income_total - r.expenses_total - r.tax_total,
    portfolio: (r.assets_p1_total ?? 0) + (r.assets_p2_total ?? 0) + (r.assets_pooled_total ?? 0),
    net_worth: r.net_worth ?? 0,
    phase: r.age_person1 >= (household.person1_retirement_age ?? 65) ? 'retirement' : 'accumulation',
    income_ss_person1: r.income_ss_person1 ?? 0,
    income_ss_person2: r.income_ss_person2 ?? 0,
    income_rmd_p1: r.income_rmd_p1 ?? 0,
    income_rmd_p2: r.income_rmd_p2 ?? 0,
    income_earned_p1: r.income_earned_p1 ?? 0,
    income_earned_p2: r.income_earned_p2 ?? 0,
    income_other_p1: r.income_other_p1 ?? 0,
    income_other_p2: r.income_other_p2 ?? 0,
    income_other_pooled: r.income_other_pooled ?? 0,
    age_person1: r.age_person1,
    age_person2: r.age_person2 ?? null,
  }))
}
