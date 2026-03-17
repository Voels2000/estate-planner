import { z } from 'zod'

export const FILING_STATUSES = [
  'single',
  'married_filing_jointly',
  'married_filing_separately',
  'head_of_household',
  'qualifying_surviving_spouse',
] as const

export const householdFormSchema = z.object({
  person1_name: z.string().min(1, 'Primary person name is required').max(200),
  person1_birth_year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  person1_retirement_age: z.coerce.number().int().min(18).max(100).optional().nullable(),
  person1_ss_claiming_age: z.coerce.number().int().min(62).max(70).optional().nullable(),
  person1_longevity_age: z.coerce.number().int().min(50).max(120).optional().nullable(),
  has_spouse: z.boolean().default(false),
  person2_name: z.string().max(200).optional().or(z.literal('')),
  person2_birth_year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  person2_retirement_age: z.coerce.number().int().min(18).max(100).optional().nullable(),
  person2_ss_claiming_age: z.coerce.number().int().min(62).max(70).optional().nullable(),
  person2_longevity_age: z.coerce.number().int().min(50).max(120).optional().nullable(),
  filing_status: z.enum(FILING_STATUSES, {
    message: 'Please select a filing status',
  }),
  state_primary: z.string().max(2).optional().default(''),
  state_compare: z.string().max(2).optional().default(''),
  inflation_rate: z.coerce
    .number()
    .min(0, 'Inflation must be at least 0%')
    .max(20, 'Inflation must be at most 20%')
    .default(3),
  growth_rate_accumulation: z.coerce
    .number()
    .min(-10, 'Growth rate must be at least -10%')
    .max(30, 'Growth rate must be at most 30%')
    .default(7),
  growth_rate_retirement: z.coerce
    .number()
    .min(-10, 'Growth rate must be at least -10%')
    .max(30, 'Growth rate must be at most 30%')
    .default(5),
})

export type HouseholdFormValues = z.output<typeof householdFormSchema>

/** Shape sent to Supabase (households table) - exact column names */
export type HouseholdRow = {
  id?: string
  owner_id: string
  person1_name: string
  person1_birth_year: number | null
  person1_retirement_age: number | null
  person1_ss_claiming_age: number | null
  person1_longevity_age: number | null
  has_spouse: boolean
  person2_name: string | null
  person2_birth_year: number | null
  person2_retirement_age: number | null
  person2_ss_claiming_age: number | null
  person2_longevity_age: number | null
  filing_status: string
  state_primary: string | null
  state_compare: string | null
  inflation_rate: number
  growth_rate_accumulation?: number
  growth_rate_retirement?: number
  created_at?: string
  updated_at?: string
}
