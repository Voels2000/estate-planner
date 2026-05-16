import type { createClient } from '@/lib/supabase/server'
import {
  parseTitlingEntityRef,
  verifyTitlingEntityOwnership,
  type TitlingEntityRef,
} from '@/lib/titling/assetBeneficiaries'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export const VALID_TITLE_TYPES = [
  'sole',
  'joint_wros',
  'tenants_in_common',
  'community_property',
  'tod_pod',
  'trust_owned',
  'corporate',
] as const

export type ValidTitleType = (typeof VALID_TITLE_TYPES)[number]

export const ASSET_TITLING_SELECT = 'id, asset_id, title_type, notes'
export const REAL_ESTATE_TITLING_SELECT = 'id, real_estate_id, title_type, notes'
export const INSURANCE_POLICY_TITLING_SELECT = 'id, insurance_policy_id, title_type, notes'
export const BUSINESS_TITLING_SELECT = 'id, business_id, title_type, notes'

type TitlingTableConfig = {
  table: string
  fkColumn: string
  select: string
  entityTable: string
  entityOwnerColumn: 'owner_id' | 'user_id'
  entitySelect: string
}

function configForRef(ref: TitlingEntityRef): TitlingTableConfig | null {
  if (ref.asset_id) {
    return {
      table: 'asset_titling',
      fkColumn: 'asset_id',
      select: ASSET_TITLING_SELECT,
      entityTable: 'assets',
      entityOwnerColumn: 'owner_id',
      entitySelect: 'id, name, type, value, owner, cost_basis, basis_date, titling, liquidity',
    }
  }
  if (ref.real_estate_id) {
    return {
      table: 'real_estate_titling',
      fkColumn: 'real_estate_id',
      select: REAL_ESTATE_TITLING_SELECT,
      entityTable: 'real_estate',
      entityOwnerColumn: 'owner_id',
      entitySelect:
        'id, name, property_type, current_value, owner, titling, liquidity, cost_basis, basis_date',
    }
  }
  if (ref.insurance_policy_id) {
    return {
      table: 'insurance_policy_titling',
      fkColumn: 'insurance_policy_id',
      select: INSURANCE_POLICY_TITLING_SELECT,
      entityTable: 'insurance_policies',
      entityOwnerColumn: 'user_id',
      entitySelect:
        'id, policy_name, insurance_type, death_benefit, owner, titling, liquidity, cost_basis, basis_date',
    }
  }
  if (ref.business_id) {
    return {
      table: 'business_titling',
      fkColumn: 'business_id',
      select: BUSINESS_TITLING_SELECT,
      entityTable: 'businesses',
      entityOwnerColumn: 'owner_id',
      entitySelect:
        'id, name, estimated_value, entity_type, owner, titling, liquidity, cost_basis, basis_date',
    }
  }
  return null
}

function entityIdFromRef(ref: TitlingEntityRef): string {
  return (
    ref.asset_id ??
    ref.real_estate_id ??
    ref.insurance_policy_id ??
    ref.business_id ??
    ''
  )
}

export function parseEntityTitlingBody(body: Record<string, unknown>):
  | {
      ok: true
      ref: TitlingEntityRef
      titlingRowId: string | null
      titleType: ValidTitleType
      notes: string | null
      entityTitling: string | null
      liquidity: string | null
      costBasis: number | null
      basisDate: string | null
    }
  | { ok: false; error: string } {
  const parsedRef = parseTitlingEntityRef(body)
  if (!parsedRef.ok) return parsedRef

  const title_type = body.title_type as string
  if (!(VALID_TITLE_TYPES as readonly string[]).includes(title_type)) {
    return { ok: false, error: 'Invalid title_type' }
  }

  const costBasisRaw = body.cost_basis
  let costBasis: number | null = null
  if (costBasisRaw !== undefined && costBasisRaw !== null && costBasisRaw !== '') {
    const n = Number(costBasisRaw)
    if (!Number.isFinite(n)) {
      return { ok: false, error: 'cost_basis must be a valid number' }
    }
    costBasis = n
  }

  const titlingRowId =
    typeof body.titling_row_id === 'string' && body.titling_row_id.trim()
      ? body.titling_row_id.trim()
      : null

  return {
    ok: true,
    ref: parsedRef.ref,
    titlingRowId,
    titleType: title_type as ValidTitleType,
    notes: (body.notes as string | null | undefined)?.trim() || null,
    entityTitling: (body.titling as string | null | undefined)?.trim() || null,
    liquidity: (body.liquidity as string | null | undefined)?.trim() || null,
    costBasis,
    basisDate: (body.basis_date as string | null | undefined)?.trim() || null,
  }
}

export async function saveEntityTitling(
  supabase: ServerSupabase,
  userId: string,
  input: Extract<ReturnType<typeof parseEntityTitlingBody>, { ok: true }>,
) {
  const cfg = configForRef(input.ref)
  if (!cfg) return { error: 'Invalid entity reference' as const }

  const entityId = entityIdFromRef(input.ref)
  const now = new Date().toISOString()

  const titlingPayload = {
    title_type: input.titleType,
    notes: input.notes,
    updated_at: now,
  }

  let titlingRow: unknown = null

  if (input.titlingRowId) {
    const { data: existing, error: fetchErr } = await supabase
      .from(cfg.table)
      .select(cfg.select)
      .eq('id', input.titlingRowId)
      .eq('owner_id', userId)
      .eq(cfg.fkColumn, entityId)
      .maybeSingle()

    if (fetchErr) return { error: fetchErr.message }
    if (!existing) return { error: 'Titling row not found' }

    const { data, error } = await supabase
      .from(cfg.table)
      .update(titlingPayload)
      .eq('id', input.titlingRowId)
      .eq('owner_id', userId)
      .select(cfg.select)
      .single()

    if (error) return { error: error.message }
    titlingRow = data
  } else {
    const { data: existing } = await supabase
      .from(cfg.table)
      .select('id')
      .eq('owner_id', userId)
      .eq(cfg.fkColumn, entityId)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabase
        .from(cfg.table)
        .update(titlingPayload)
        .eq('id', existing.id)
        .select(cfg.select)
        .single()
      if (error) return { error: error.message }
      titlingRow = data
    } else {
      const { data, error } = await supabase
        .from(cfg.table)
        .insert({
          ...titlingPayload,
          owner_id: userId,
          [cfg.fkColumn]: entityId,
        })
        .select(cfg.select)
        .single()
      if (error) return { error: error.message }
      titlingRow = data
    }
  }

  const entityUpdate = {
    titling: input.entityTitling,
    liquidity: input.liquidity,
    cost_basis: input.costBasis,
    basis_date: input.basisDate,
    updated_at: now,
  }

  const entityQuery = supabase
    .from(cfg.entityTable)
    .update(entityUpdate)
    .eq('id', entityId)
    .eq(cfg.entityOwnerColumn, userId)
    .select(cfg.entitySelect)
    .single()

  const { data: entity, error: entityErr } = await entityQuery
  if (entityErr) return { error: entityErr.message }

  return { titling: titlingRow, entity }
}

export async function assertEntityTitlingAccess(
  supabase: ServerSupabase,
  userId: string,
  ref: TitlingEntityRef,
): Promise<boolean> {
  return verifyTitlingEntityOwnership(supabase, userId, ref)
}
