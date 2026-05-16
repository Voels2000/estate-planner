import type { createClient } from '@/lib/supabase/server'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type AssetBeneficiaryRow = {
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
  is_gst_skip: boolean
}

export const ASSET_BENEFICIARY_SELECT =
  'id, asset_id, real_estate_id, insurance_policy_id, business_id, beneficiary_type, full_name, relationship, email, phone, allocation_pct, is_gst_skip'

export type TitlingEntityRef = {
  asset_id: string | null
  real_estate_id: string | null
  insurance_policy_id: string | null
  business_id: string | null
}

export function parseTitlingEntityRef(body: Record<string, unknown>):
  | { ok: true; ref: TitlingEntityRef }
  | { ok: false; error: string } {
  const asset_id = (body.asset_id as string | null | undefined) ?? null
  const real_estate_id = (body.real_estate_id as string | null | undefined) ?? null
  const insurance_policy_id = (body.insurance_policy_id as string | null | undefined) ?? null
  const business_id = (body.business_id as string | null | undefined) ?? null
  const set = [asset_id, real_estate_id, insurance_policy_id, business_id].filter(Boolean)
  if (set.length !== 1) {
    return { ok: false, error: 'Exactly one of asset_id, real_estate_id, insurance_policy_id, business_id is required' }
  }
  return { ok: true, ref: { asset_id, real_estate_id, insurance_policy_id, business_id } }
}

export async function verifyTitlingEntityOwnership(
  supabase: ServerSupabase,
  userId: string,
  ref: TitlingEntityRef,
): Promise<boolean> {
  if (ref.asset_id) {
    const { data } = await supabase
      .from('assets')
      .select('id')
      .eq('id', ref.asset_id)
      .eq('owner_id', userId)
      .maybeSingle()
    return !!data
  }
  if (ref.real_estate_id) {
    const { data } = await supabase
      .from('real_estate')
      .select('id')
      .eq('id', ref.real_estate_id)
      .eq('owner_id', userId)
      .maybeSingle()
    return !!data
  }
  if (ref.insurance_policy_id) {
    const { data } = await supabase
      .from('insurance_policies')
      .select('id')
      .eq('id', ref.insurance_policy_id)
      .eq('user_id', userId)
      .maybeSingle()
    return !!data
  }
  if (ref.business_id) {
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', ref.business_id)
      .eq('owner_id', userId)
      .maybeSingle()
    return !!data
  }
  return false
}

export function buildBeneficiaryPayload(body: Record<string, unknown>) {
  const beneficiary_type = body.beneficiary_type as string
  if (beneficiary_type !== 'primary' && beneficiary_type !== 'contingent') {
    return { error: 'beneficiary_type must be primary or contingent' as const }
  }
  const full_name = (body.full_name as string | undefined)?.trim()
  if (!full_name) return { error: 'full_name required' as const }
  const allocation_pct = Number(body.allocation_pct)
  if (!Number.isFinite(allocation_pct) || allocation_pct <= 0 || allocation_pct > 100) {
    return { error: 'allocation_pct must be between 0 and 100' as const }
  }
  return {
    fields: {
      beneficiary_type,
      full_name,
      relationship: (body.relationship as string | null | undefined)?.trim() || null,
      email: (body.email as string | null | undefined)?.trim() || null,
      phone: (body.phone as string | null | undefined)?.trim() || null,
      allocation_pct,
      is_gst_skip: Boolean(body.is_gst_skip),
      updated_at: new Date().toISOString(),
    },
  }
}

export async function touchBeneficiaryReview(supabase: ServerSupabase, householdId: string) {
  await supabase
    .from('households')
    .update({ last_beneficiary_review: new Date().toISOString() })
    .eq('id', householdId)
}
