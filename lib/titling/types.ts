export type TitlingKind = 'asset' | 're' | 'insurance' | 'business'

export type Beneficiary = {
  id: string
  asset_id: string | null
  real_estate_id: string | null
  insurance_policy_id: string | null
  business_id: string | null
  beneficiary_type: 'primary' | 'contingent'
  full_name: string
  relationship: string | null
  email: string | null
  phone: string | null
  allocation_pct: number
  is_gst_skip?: boolean
}

export type AssetTitling = {
  id: string
  asset_id: string
  title_type: string
  notes: string | null
}

export type RealEstateTitling = {
  id: string
  real_estate_id: string
  title_type: string
  notes: string | null
}

export type InsurancePolicyTitling = {
  id: string
  insurance_policy_id: string
  title_type: string
  notes: string | null
}

export type BusinessTitlingRow = {
  id: string
  business_id: string
  title_type: string
  notes: string | null
}

export type AnyTitling = AssetTitling | RealEstateTitling | InsurancePolicyTitling | BusinessTitlingRow
