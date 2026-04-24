import { z } from 'zod'

export const EXPENSE_CATEGORIES = [
  'housing',
  'healthcare',
  'food',
  'travel',
  'entertainment',
  'charitable',
  'other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  housing: 'Housing',
  healthcare: 'Healthcare',
  food: 'Food',
  travel: 'Travel',
  entertainment: 'Entertainment',
  charitable: 'Charitable',
  other: 'Other',
}

export const expenseFormSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES, { message: 'Please select a category' }),
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

export type ExpenseFormValues = z.output<typeof expenseFormSchema>

/** Row from Supabase (expenses table) for display */
export type ExpenseRow = {
  id: string
  owner_id: string
  amount: number
  category: ExpenseCategory | string | null
  start_year: number | null
  end_year: number | null
  inflation_adjust: boolean
  created_at?: string
  updated_at?: string
}
