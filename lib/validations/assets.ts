import { z } from 'zod'

export const ASSET_TYPES = [
  'primary_residence',
  'taxable_brokerage',
  'traditional_401k',
  'roth_ira',
  'traditional_ira',
] as const

export type AssetType = (typeof ASSET_TYPES)[number]

export const assetTypeLabels: Record<AssetType, string> = {
  primary_residence: 'Primary residence',
  taxable_brokerage: 'Taxable brokerage',
  traditional_401k: 'Traditional 401(k)',
  roth_ira: 'Roth IRA',
  traditional_ira: 'Traditional IRA',
}

/** Base fields shared by all assets */
const assetBaseSchema = z.object({
  type: z.enum(ASSET_TYPES, { message: 'Please select an asset type' }),
  name: z.string().min(1, 'Name is required').max(200),
  value: z.coerce
    .number()
    .min(0, 'Value must be 0 or greater'),
})

/** Form values: base + optional details (validated per type in component) */
export const assetFormSchema = assetBaseSchema.extend({
  // Primary residence
  address: z.string().optional().default(''),
  mortgage_balance: z.union([z.coerce.number().min(0), z.literal('')]).optional().default(''),
  // Brokerage / IRA
  institution: z.string().optional().default(''),
  // 401k only
  employer_match_pct: z.union([z.coerce.number().min(0).max(100), z.literal('')]).optional().default(''),
})

export type AssetFormValues = z.output<typeof assetFormSchema>

/** Row from Supabase (assets table) */
export type AssetRow = {
  id: string
  owner_id: string
  tsowner: string
  type: AssetType
  name: string
  value: number
  details: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

/** Build details object for DB from form values by type */
export function buildAssetDetails(type: AssetType, values: AssetFormValues): Record<string, unknown> {
  const details: Record<string, unknown> = {}
  switch (type) {
    case 'primary_residence':
      if (values.address?.trim()) details.address = values.address.trim()
      if (values.mortgage_balance !== '' && values.mortgage_balance != null)
        details.mortgage_balance = Number(values.mortgage_balance)
      break
    case 'taxable_brokerage':
    case 'roth_ira':
    case 'traditional_ira':
      if (values.institution?.trim()) details.institution = values.institution.trim()
      break
    case 'traditional_401k':
      if (values.institution?.trim()) details.institution = values.institution.trim()
      if (values.employer_match_pct !== '' && values.employer_match_pct != null)
        details.employer_match_pct = Number(values.employer_match_pct)
      break
  }
  return details
}

export function parseDetails<T extends Record<string, unknown>>(details: T | null): T {
  if (details && typeof details === 'object') return details as T
  return {} as T
}
