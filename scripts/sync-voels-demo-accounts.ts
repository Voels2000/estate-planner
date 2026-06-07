/**
 * Sync Voels demo client (avoels@outlook.com) from advisor source (avoels@comcast.net).
 *
 * Run after updating the advisor "My Plan" household so the linked consumer client matches.
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/sync-voels-demo-accounts.ts
 *
 * Optional env overrides:
 *   VOELS_SOURCE_EMAIL=avoels@comcast.net
 *   VOELS_TARGET_EMAIL=avoels@outlook.com
 *   DRY_RUN=1  — print planned updates without writing
 */
import { createClient } from '@supabase/supabase-js'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { upsertCompositionCache } from '@/lib/estate/getCachedComposition'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const recomputeSecret = process.env.RECOMPUTE_SECRET
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const SOURCE_EMAIL = process.env.VOELS_SOURCE_EMAIL ?? 'avoels@comcast.net'
const TARGET_EMAIL = process.env.VOELS_TARGET_EMAIL ?? 'avoels@outlook.com'
const DRY_RUN = process.env.DRY_RUN === '1'

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

type Row = Record<string, unknown>

function pairKey(name: string, type: string) {
  return `${name.trim()}|${type.trim()}`
}

function sortRows<T extends { value?: number | null; current_value?: number | null; id: string }>(
  rows: T[],
  valueKey: 'value' | 'current_value',
): T[] {
  return [...rows].sort((a, b) => {
    const diff = Number(b[valueKey] ?? 0) - Number(a[valueKey] ?? 0)
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  })
}

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

async function resolveUser(email: string) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('email', email)
    .maybeSingle()
  if (error || !profile) throw new Error(`Profile not found for ${email}`)
  const { data: household } = await admin
    .from('households')
    .select('id, name, owner_id, person1_first_name, person1_last_name, person2_first_name, person2_last_name, filing_status, state_primary, has_spouse')
    .eq('owner_id', profile.id)
    .maybeSingle()
  return { profile, household }
}

async function syncNumericTable(params: {
  table: string
  sourceOwnerId: string
  targetOwnerId: string
  nameField: string
  typeField?: string
  valueField: string
  extraFields?: string[]
}) {
  const select = ['id', params.nameField, params.valueField, ...(params.typeField ? [params.typeField] : []), ...(params.extraFields ?? [])].join(', ')
  const ownerCol = params.table === 'insurance_policies' ? 'user_id' : 'owner_id'
  const [{ data: sourceRows }, { data: targetRows }] = await Promise.all([
    admin.from(params.table).select(select).eq(ownerCol, params.sourceOwnerId),
    admin.from(params.table).select(select).eq(ownerCol, params.targetOwnerId),
  ])

  const group = (rows: Row[]) => {
    const map = new Map<string, Row[]>()
    for (const row of rows) {
      const name = String(row[params.nameField] ?? '')
      const type = params.typeField ? String(row[params.typeField] ?? '') : ''
      const key = params.typeField ? pairKey(name, type) : name.trim()
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    for (const [k, list] of map) {
      map.set(
        k,
        sortRows(
          list as Array<{ id: string; value?: number | null; current_value?: number | null }>,
          params.valueField === 'current_value' ? 'current_value' : 'value',
        ),
      )
    }
    return map
  }

  const sourceMap = group(sourceRows ?? [])
  const targetMap = group(targetRows ?? [])
  const updates: Array<{ id: string; label: string; from: number; to: number; patch: Row }> = []

  for (const [key, sourceList] of sourceMap) {
    const targetList = targetMap.get(key) ?? []
    if (targetList.length !== sourceList.length) {
      console.warn(`  [${params.table}] row count mismatch for ${key}: source=${sourceList.length} target=${targetList.length}`)
      continue
    }
    for (let i = 0; i < sourceList.length; i += 1) {
      const src = sourceList[i]
      const tgt = targetList[i]
      const toValue = Number(src[params.valueField] ?? 0)
      const fromValue = Number(tgt[params.valueField] ?? 0)
      const patch: Row = { [params.valueField]: toValue, updated_at: new Date().toISOString() }
      for (const field of params.extraFields ?? []) {
        if (src[field] !== undefined && src[field] !== tgt[field]) {
          patch[field] = src[field]
        }
      }
      if (Math.abs(toValue - fromValue) > 0.01 || Object.keys(patch).length > 2) {
        updates.push({
          id: String(tgt.id),
          label: key,
          from: fromValue,
          to: toValue,
          patch,
        })
      }
    }
  }

  if (updates.length === 0) {
    console.log(`  ${params.table}: already in sync`)
    return 0
  }

  console.log(`  ${params.table}: ${updates.length} row(s) to update`)
  for (const u of updates) {
    console.log(`    ${u.label}: ${fmt(u.from)} → ${fmt(u.to)}`)
    if (!DRY_RUN) {
      const { error } = await admin.from(params.table).update(u.patch).eq('id', u.id)
      if (error) throw new Error(`${params.table} update failed for ${u.label}: ${error.message}`)
    }
  }
  return updates.length
}

async function syncHouseholdFields(sourceHousehold: Row, targetHouseholdId: string) {
  const fields = [
    'person1_first_name',
    'person1_last_name',
    'person2_first_name',
    'person2_last_name',
    'filing_status',
    'state_primary',
    'has_spouse',
  ] as const
  const patch: Row = {}
  for (const field of fields) {
    if (sourceHousehold[field] !== undefined) patch[field] = sourceHousehold[field]
  }
  patch.updated_at = new Date().toISOString()
  if (DRY_RUN) {
    console.log('  households: would patch', patch)
    return
  }
  const { error } = await admin.from('households').update(patch).eq('id', targetHouseholdId)
  if (error) throw new Error(`household update failed: ${error.message}`)
  console.log('  households: profile fields synced')
}

async function recomputeTarget(householdId: string) {
  if (DRY_RUN) {
    console.log('  recompute: skipped (dry run)')
    return
  }
  if (recomputeSecret) {
    const res = await fetch(`${appUrl.replace(/\/$/, '')}/api/recompute-estate-health`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-recompute-secret': recomputeSecret,
      },
      body: JSON.stringify({ householdId }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn(`  recompute HTTP ${res.status}: ${text}`)
    } else {
      console.log('  recompute: estate health + composition cache refreshed')
      return
    }
  }

  const { data: giftingSummary } = await admin.rpc('calculate_gifting_summary', {
    p_household_id: householdId,
  })
  const lifetimeGiftsUsed = Math.max(
    0,
    Number(
      (giftingSummary as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ?? 0,
    ),
  )
  const composition = await classifyEstateAssets(admin, householdId, 'consumer', lifetimeGiftsUsed)
  await upsertCompositionCache(admin, householdId, 'consumer', composition, lifetimeGiftsUsed)
  console.log('  recompute: composition cache upserted locally (health score not rerun)')
}

async function verifyTotals(sourceOwnerId: string, targetOwnerId: string) {
  const sumAssets = async (ownerId: string) => {
    const { data } = await admin.from('assets').select('value').eq('owner_id', ownerId)
    return (data ?? []).reduce((s, r) => s + Number(r.value ?? 0), 0)
  }
  const [a, b] = await Promise.all([sumAssets(sourceOwnerId), sumAssets(targetOwnerId)])
  console.log(`\nVerify asset totals: source ${fmt(a)} | target ${fmt(b)} | delta ${fmt(b - a)}`)
  if (Math.abs(a - b) > 1) {
    console.warn('WARNING: asset totals still differ after sync')
  } else {
    console.log('Asset totals match.')
  }
}

async function main() {
  console.log(`\nVoels demo sync (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)
  console.log(`  source: ${SOURCE_EMAIL}`)
  console.log(`  target: ${TARGET_EMAIL}\n`)

  const source = await resolveUser(SOURCE_EMAIL)
  const target = await resolveUser(TARGET_EMAIL)

  if (!source.household || !target.household) {
    throw new Error('Both accounts need an owned household')
  }

  console.log(`Source household: ${source.household.name} (${source.household.id})`)
  console.log(`Target household: ${target.household.name} (${target.household.id})\n`)

  let changed = 0
  changed += await syncNumericTable({
    table: 'assets',
    sourceOwnerId: source.profile.id,
    targetOwnerId: target.profile.id,
    nameField: 'name',
    typeField: 'type',
    valueField: 'value',
    extraFields: ['cost_basis', 'titling', 'liquidity', 'situs_state', 'owner'],
  })
  changed += await syncNumericTable({
    table: 'real_estate',
    sourceOwnerId: source.profile.id,
    targetOwnerId: target.profile.id,
    nameField: 'name',
    typeField: 'property_type',
    valueField: 'current_value',
    extraFields: ['mortgage_balance', 'monthly_payment', 'interest_rate', 'is_primary_residence', 'situs_state', 'owner'],
  })
  changed += await syncNumericTable({
    table: 'businesses',
    sourceOwnerId: source.profile.id,
    targetOwnerId: target.profile.id,
    nameField: 'name',
    typeField: 'entity_type',
    valueField: 'estimated_value',
    extraFields: ['ownership_pct', 'owner_estimated_value', 'valuation_method'],
  })
  changed += await syncNumericTable({
    table: 'insurance_policies',
    sourceOwnerId: source.profile.id,
    targetOwnerId: target.profile.id,
    nameField: 'policy_name',
    typeField: 'insurance_type',
    valueField: 'death_benefit',
    extraFields: ['cash_value', 'annual_premium', 'is_ilit', 'is_employer_provided', 'estate_inclusion_status'],
  })
  changed += await syncNumericTable({
    table: 'liabilities',
    sourceOwnerId: source.profile.id,
    targetOwnerId: target.profile.id,
    nameField: 'type',
    valueField: 'balance',
    extraFields: ['owner'],
  })

  await syncHouseholdFields(source.household, target.household.id)

  if (changed > 0 || !DRY_RUN) {
    await recomputeTarget(target.household.id)
  }

  await verifyTotals(source.profile.id, target.profile.id)

  const [{ data: compS }, { data: compT }] = await Promise.all([
    admin.rpc('calculate_estate_composition', { p_household_id: source.household.id }),
    admin.rpc('calculate_estate_composition', { p_household_id: target.household.id }),
  ])
  const gS = Number(compS?.gross_estate ?? 0)
  const gT = Number(compT?.gross_estate ?? 0)
  console.log(`Composition gross: source ${fmt(gS)} | target ${fmt(gT)} | delta ${fmt(gT - gS)}`)

  console.log('\nDone.')
  console.log('\nTo keep in sync after editing comcast My Plan data, re-run:')
  console.log('  npm run sync:voels-demo')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
