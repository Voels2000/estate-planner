import { config as loadEnv } from 'dotenv'
import { createAdminClient } from '../lib/supabase/admin'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env.vercel.local' })

const SOURCE_EMAIL = 'avoels@comcast.net'
const TARGET_EMAIL = 'avoels@outlook.com'

type Row = Record<string, unknown>

const TABLE_KEY_PRIORITY: Record<string, string[]> = {
  households: ['owner_id'],
  assets: ['owner_id'],
  liabilities: ['owner_id'],
  income: ['owner_id'],
  expenses: ['owner_id'],
  real_estate: ['owner_id'],
  businesses: ['owner_id'],
  business_interests: ['owner_id'],
  insurance_policies: ['user_id', 'owner_id'],
  trusts: ['owner_id'],
  estate_documents: ['owner_id', 'household_id'],
  asset_beneficiaries: ['owner_id'],
  asset_titling: ['owner_id'],
  insurance_policy_titling: ['owner_id'],
  business_titling: ['owner_id'],
  projection_scenarios: ['household_id', 'owner_id'],
  monte_carlo_results: ['household_id', 'owner_id'],
  estate_health_scores: ['household_id', 'owner_id'],
  household_people: ['household_id'],
  estate_health_check: ['household_id'],
  household_alerts: ['household_id'],
  estate_flow_snapshots: ['household_id'],
  estate_flow_share_links: ['household_id'],
  digital_assets: ['household_id', 'owner_id'],
  domicile_analysis: ['user_id', 'household_id'],
  strategy_configs: ['household_id'],
}

const TABLES = Object.keys(TABLE_KEY_PRIORITY)

function normalizeRow(row: Row): Row {
  const out: Row = {}
  const skip = new Set([
    'id',
    'created_at',
    'updated_at',
    'owner_id',
    'user_id',
    'household_id',
    'asset_id',
    'business_id',
    'insurance_policy_id',
    'analysis_id',
    'snapshot_id',
  ])
  for (const key of Object.keys(row).sort()) {
    if (skip.has(key)) continue
    out[key] = row[key]
  }
  return out
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

async function fetchRows(admin: ReturnType<typeof createAdminClient>, table: string, key: string, id: string) {
  const { data, error } = await admin.from(table).select('*').eq(key, id)
  return { data: (data ?? []) as Row[], error: error?.message ?? null }
}

async function findWorkingKey(admin: ReturnType<typeof createAdminClient>, table: string, sourceUserId: string, sourceHouseholdId: string) {
  for (const key of TABLE_KEY_PRIORITY[table] ?? []) {
    const probeId = key === 'household_id' ? sourceHouseholdId : sourceUserId
    const probe = await fetchRows(admin, table, key, probeId)
    if (!probe.error) return key
  }
  return null
}

async function main() {
  const admin = createAdminClient()

  const { data: sourceProfile } = await admin.from('profiles').select('id').eq('email', SOURCE_EMAIL).maybeSingle()
  const { data: targetProfile } = await admin.from('profiles').select('id').eq('email', TARGET_EMAIL).maybeSingle()
  if (!sourceProfile?.id || !targetProfile?.id) {
    throw new Error('Missing source or target profile.')
  }

  const sourceUserId = sourceProfile.id
  const targetUserId = targetProfile.id

  const { data: sourceHousehold } = await admin.from('households').select('id').eq('owner_id', sourceUserId).maybeSingle()
  const { data: targetHousehold } = await admin.from('households').select('id').eq('owner_id', targetUserId).maybeSingle()
  if (!sourceHousehold?.id || !targetHousehold?.id) {
    throw new Error('Missing source or target household.')
  }

  console.log(`Comparing ${SOURCE_EMAIL} -> ${TARGET_EMAIL}`)
  console.log(`sourceUser=${sourceUserId} targetUser=${targetUserId}`)
  console.log(`sourceHousehold=${sourceHousehold.id} targetHousehold=${targetHousehold.id}`)
  console.log('')

  let allMatch = true

  for (const table of TABLES) {
    const key = await findWorkingKey(admin, table, sourceUserId, sourceHousehold.id)
    if (!key) {
      console.log(`SKIP  ${table} (no working key column from: ${TABLE_KEY_PRIORITY[table].join(', ')})`)
      continue
    }

    const sourceId = key === 'household_id' ? sourceHousehold.id : sourceUserId
    const targetId = key === 'household_id' ? targetHousehold.id : targetUserId
    const sourceRes = await fetchRows(admin, table, key, sourceId)
    const targetRes = await fetchRows(admin, table, key, targetId)

    if (sourceRes.error || targetRes.error) {
      console.log(`SKIP  ${table} (${sourceRes.error ?? targetRes.error})`)
      continue
    }

    const sourceNorm = sourceRes.data.map(normalizeRow).map(stableStringify).sort()
    const targetNorm = targetRes.data.map(normalizeRow).map(stableStringify).sort()
    const same = sourceNorm.length === targetNorm.length && sourceNorm.every((v, i) => v === targetNorm[i])

    if (!same) allMatch = false
    const label = same ? 'MATCH' : 'DIFF '
    console.log(`${label} ${table} source=${sourceNorm.length} target=${targetNorm.length} key=${key}`)
  }

  console.log('')
  console.log(allMatch ? 'OVERALL: MATCH' : 'OVERALL: DIFFERENCES FOUND')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

