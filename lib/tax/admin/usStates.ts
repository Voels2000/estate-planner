import {
  MODELED_ESTATE_TAX_STATES,
  MODELED_INHERITANCE_TAX_STATES,
  NO_STATE_INCOME_TAX_STATES,
} from '@/lib/calculations/stateEstateTax'

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
] as const

export const NO_INCOME_TAX = new Set<string>(NO_STATE_INCOME_TAX_STATES)
export const MODELED_ESTATE = [...MODELED_ESTATE_TAX_STATES]
export const MODELED_INHERITANCE = [...MODELED_INHERITANCE_TAX_STATES]

export function normalizeFilingStatus(fs: string): 'single' | 'mfj' | '' {
  const s = fs.toLowerCase()
  if (['single', 's', 'mfs', 'married_filing_separately', 'head_of_household', 'hoh'].includes(s)) {
    return 'single'
  }
  if (['mfj', 'married_joint', 'married_filing_jointly', 'joint', 'qw', 'qualifying_widow'].includes(s)) {
    return 'mfj'
  }
  return ''
}
