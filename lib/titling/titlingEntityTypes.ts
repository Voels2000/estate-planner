import type { TitlingKind } from './types'

export type Asset = {
  id: string
  name: string
  type: string
  value: number
  owner: string | null
  cost_basis?: number | null
  basis_date?: string | null
  titling?: string | null
  liquidity?: string | null
}

export type RealEstateItem = {
  id: string
  name: string
  property_type: string
  current_value: number
  owner: string | null
  titling: string | null
  liquidity: string | null
  cost_basis: number | null
  basis_date: string | null
}

export type InsurancePolicyRow = {
  id: string
  policy_name: string | null
  insurance_type: string | null
  death_benefit: number | null
  owner: string | null
  titling: string | null
  liquidity: string | null
  cost_basis: number | null
  basis_date: string | null
}

export type BusinessRow = {
  id: string
  name: string
  estimated_value: number | null
  entity_type: string | null
  owner: string | null
  titling: string | null
  liquidity: string | null
  cost_basis: number | null
  basis_date: string | null
}

export type TitlingCategory = {
  value: string
  label: string
  icon: string
  sort_order: number
  is_active: boolean
}

export type HouseholdPersonRow = {
  id: string
  full_name: string
  relationship: string
  date_of_birth: string | null
  is_gst_skip: boolean
}

export type BeneficiaryPicklistOption = {
  value: string
  label: string
  fullName: string
  relationship: string
  isGst: boolean
}

export type GapItem = {
  kind: TitlingKind
  id: string
  name: string
  subtitle: string
  owner: string | null
  needsPrimary: boolean
  needsContingent: boolean
}

export type TitlingEntityRow = RealEstateItem | InsurancePolicyRow | BusinessRow
