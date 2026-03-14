import { z } from 'zod'

export const INCOME_SOURCES = [
  'salary',
  'social_security',
  'pension',
  'rental',
  'other',
] as const

export type IncomeSource = (typeof INCOME_SOURCES)[number]

export const incomeSourceLabels: Record<IncomeSource, string> = {
  salary: 'Salary',
  social_security: 'Social Security',
  pension: 'Pension',
  rental: 'Rental',
  other: 'Other',
}

const currentYear = new Date().getFullYear()

export const incomeFormSchema = z.object({
  source: z.enum(INCOME_SOURCES, { message: 'Please select a source' }),
  amount: z.coerce.number().min(0, 'Amount must be 0 or greater'),
  start_year: z.coerce.number().int().min(1900).max(2100),
  end_year: z.union([
    z.coerce.number().int().min(1900).max(2100),
    z.literal(''),
  ]),
  inflation_adjust: z.boolean(),
}).refine(
  (data) => {
    if (data.end_year === '' || data.end_year == null) return true
    return Number(data.end_year) >= data.start_year
  },
  { message: 'End year must be on or after start year', path: ['end_year'] }
)

export type IncomeFormValues = z.output<typeof incomeFormSchema>

/** Row from Supabase (income table) for display */
export type IncomeRow = {
  id: string
  owner_id: string
  amount: number
  source: IncomeSource | string | null
  start_year: number | null
  end_year: number | null
  inflation_adjust: boolean
  created_at?: string
  updated_at?: string
}
