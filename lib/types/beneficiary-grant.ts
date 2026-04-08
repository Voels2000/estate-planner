// Sprint 63 - Second-Generation Portal + Digital Asset Inventory

export type AccessLevel = 'view' | 'full'

export type BeneficiaryRelationship =
  | 'child'
  | 'grandchild'
  | 'spouse'
  | 'domestic_partner'
  | 'sibling'
  | 'trustee'
  | 'executor'
  | 'other'

export interface BeneficiaryAccessGrant {
  id: string
  household_id: string
  granted_by_user_id: string
  grantee_email: string
  grantee_name: string
  relationship: BeneficiaryRelationship
  access_level: AccessLevel
  token: string
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  revoked_by_user_id: string | null
  last_accessed_at: string | null
  access_log: AccessLogEntry[]
}

export interface AccessLogEntry {
  at: string
  ip?: string
  action: 'view' | 'revoke' | 'email_sent'
}

export interface CreateGrantPayload {
  household_id: string
  grantee_email: string
  grantee_name: string
  relationship: BeneficiaryRelationship
  access_level: AccessLevel
  expires_at?: string | null
}

// Digital Asset types (extends Sprint 57 digital_assets table)
export type DigitalAssetType =
  | 'crypto'
  | 'nft'
  | 'online_account'
  | 'domain'
  | 'digital_media'

export interface DigitalAsset {
  id: string
  household_id: string
  asset_type: DigitalAssetType
  platform: string
  description: string
  estimated_value: number | null
  access_instructions: string | null // encrypted at app layer
  wallet_address: string | null
  account_username: string | null
  storage_location: string | null // e.g. "LastPass vault", "hardware wallet in safe"
  executor_grantee_email: string | null
  executor_notes: string | null
  created_at: string
  updated_at: string
}

// Beneficiary view payload returned from get_grant_for_token RPC
export interface BeneficiaryGrantTokenPayload {
  grant_id: string
  household_id: string
  grantee_name: string
  grantee_email: string
  relationship: BeneficiaryRelationship
  access_level: AccessLevel
  granted_at: string
  expires_at: string | null
  error?: string
}
