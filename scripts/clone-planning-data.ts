import { createAdminClient } from '../lib/supabase/admin'
import { config as loadEnv } from 'dotenv'

type JsonRecord = Record<string, unknown>

const SOURCE_EMAIL = 'avoels@comcast.net'
const TARGET_EMAIL = 'avoels@outlook.com'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env.vercel.local' })

const OWNER_ONLY_TABLES = [
  'assets',
  'liabilities',
  'income',
  'expenses',
  'real_estate',
  'beneficiaries',
  'businesses',
  'business_interests',
  'insurance_policies',
  'trusts',
  'estate_documents',
  'asset_beneficiaries',
  'asset_titling',
  'insurance_policy_titling',
  'business_titling',
  'projection_scenarios',
  'monte_carlo_results',
  'estate_health_scores',
] as const

const HOUSEHOLD_ONLY_TABLES = [
  'household_people',
  'estate_health_check',
  'household_alerts',
  'estate_flow_snapshots',
  'estate_flow_share_links',
  'digital_assets',
] as const

const USER_ONLY_TABLES = ['domicile_analysis'] as const

const OWNER_HOUSEHOLD_TABLES = ['strategy_configs'] as const

function stripManagedColumns(row: JsonRecord): JsonRecord {
  const next = { ...row }
  delete next.id
  delete next.created_at
  delete next.updated_at
  return next
}

async function safeDeleteByEq(admin: ReturnType<typeof createAdminClient>, table: string, column: string, value: string) {
  const { error } = await admin.from(table).delete().eq(column, value)
  if (error) {
    console.warn(`Delete skipped for ${table} (${column}): ${error.message}`)
  }
}

async function safeSelectByEq(admin: ReturnType<typeof createAdminClient>, table: string, column: string, value: string) {
  const { data, error } = await admin.from(table).select('*').eq(column, value)
  if (error) {
    console.warn(`Select skipped for ${table} (${column}): ${error.message}`)
    return [] as JsonRecord[]
  }
  return (data ?? []) as JsonRecord[]
}

async function safeInsert(admin: ReturnType<typeof createAdminClient>, table: string, rows: JsonRecord[]) {
  if (!rows.length) return
  const { error } = await admin.from(table).insert(rows)
  if (error) {
    console.warn(`Insert skipped for ${table}: ${error.message}`)
  }
}

async function main() {
  const admin = createAdminClient()

  const { data: sourceProfile, error: sourceError } = await admin
    .from('profiles')
    .select('id, email')
    .eq('email', SOURCE_EMAIL)
    .maybeSingle()

  const { data: targetProfile, error: targetError } = await admin
    .from('profiles')
    .select('id, email')
    .eq('email', TARGET_EMAIL)
    .maybeSingle()

  if (sourceError || !sourceProfile?.id) {
    throw new Error(`Could not find source profile ${SOURCE_EMAIL}: ${sourceError?.message ?? 'not found'}`)
  }
  if (targetError || !targetProfile?.id) {
    throw new Error(`Could not find target profile ${TARGET_EMAIL}: ${targetError?.message ?? 'not found'}`)
  }

  const sourceUserId = sourceProfile.id
  const targetUserId = targetProfile.id

  const { data: sourceHousehold } = await admin
    .from('households')
    .select('*')
    .eq('owner_id', sourceUserId)
    .maybeSingle()

  if (!sourceHousehold) {
    throw new Error(`No household found for source user ${SOURCE_EMAIL}`)
  }

  const { data: targetHouseholdExisting } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', targetUserId)
    .maybeSingle()

  const targetHouseholdId = targetHouseholdExisting?.id ?? crypto.randomUUID()

  console.log('Source user:', sourceUserId)
  console.log('Target user:', targetUserId)
  console.log('Source household:', sourceHousehold.id)
  console.log('Target household:', targetHouseholdId)

  // 1) Delete current planning data for target user.
  for (const table of HOUSEHOLD_ONLY_TABLES) {
    if (targetHouseholdExisting?.id) {
      await safeDeleteByEq(admin, table, 'household_id', targetHouseholdExisting.id)
    }
  }
  for (const table of USER_ONLY_TABLES) {
    await safeDeleteByEq(admin, table, 'user_id', targetUserId)
  }
  for (const table of OWNER_HOUSEHOLD_TABLES) {
    if (targetHouseholdExisting?.id) {
      await safeDeleteByEq(admin, table, 'household_id', targetHouseholdExisting.id)
    }
    await safeDeleteByEq(admin, table, 'owner_id', targetUserId)
  }
  for (const table of OWNER_ONLY_TABLES) {
    await safeDeleteByEq(admin, table, 'owner_id', targetUserId)
  }
  await safeDeleteByEq(admin, 'households', 'owner_id', targetUserId)

  // 2) Insert household first so downstream FK rows succeed.
  const householdInsert = stripManagedColumns(sourceHousehold as JsonRecord)
  householdInsert.id = targetHouseholdId
  householdInsert.owner_id = targetUserId
  householdInsert.updated_at = new Date().toISOString()
  await safeInsert(admin, 'households', [householdInsert])

  // 3) Copy owner-only rows.
  for (const table of OWNER_ONLY_TABLES) {
    const sourceRows = await safeSelectByEq(admin, table, 'owner_id', sourceUserId)
    const nextRows = sourceRows.map((row) => {
      const out = stripManagedColumns(row)
      out.owner_id = targetUserId
      if (Object.prototype.hasOwnProperty.call(out, 'household_id')) out.household_id = targetHouseholdId
      if (Object.prototype.hasOwnProperty.call(out, 'user_id')) out.user_id = targetUserId
      return out
    })
    await safeInsert(admin, table, nextRows)
  }

  // 4) Copy household-only rows.
  for (const table of HOUSEHOLD_ONLY_TABLES) {
    const sourceRows = await safeSelectByEq(admin, table, 'household_id', sourceHousehold.id as string)
    const nextRows = sourceRows.map((row) => {
      const out = stripManagedColumns(row)
      out.household_id = targetHouseholdId
      if (Object.prototype.hasOwnProperty.call(out, 'owner_id')) out.owner_id = targetUserId
      if (Object.prototype.hasOwnProperty.call(out, 'user_id')) out.user_id = targetUserId
      return out
    })
    await safeInsert(admin, table, nextRows)
  }

  // 5) Copy user-only rows.
  for (const table of USER_ONLY_TABLES) {
    const sourceRows = await safeSelectByEq(admin, table, 'user_id', sourceUserId)
    const nextRows = sourceRows.map((row) => {
      const out = stripManagedColumns(row)
      out.user_id = targetUserId
      if (Object.prototype.hasOwnProperty.call(out, 'household_id')) out.household_id = targetHouseholdId
      if (Object.prototype.hasOwnProperty.call(out, 'owner_id')) out.owner_id = targetUserId
      return out
    })
    await safeInsert(admin, table, nextRows)
  }

  // 6) Copy dual-key rows.
  for (const table of OWNER_HOUSEHOLD_TABLES) {
    const sourceRows = await safeSelectByEq(admin, table, 'owner_id', sourceUserId)
    const nextRows = sourceRows.map((row) => {
      const out = stripManagedColumns(row)
      out.owner_id = targetUserId
      out.household_id = targetHouseholdId
      if (Object.prototype.hasOwnProperty.call(out, 'user_id')) out.user_id = targetUserId
      return out
    })
    await safeInsert(admin, table, nextRows)
  }

  // 7) Verification counts.
  const verifyTables = ['households', ...OWNER_ONLY_TABLES, ...HOUSEHOLD_ONLY_TABLES, ...USER_ONLY_TABLES, ...OWNER_HOUSEHOLD_TABLES]
  console.log('\nVerification counts for target:')
  for (const table of verifyTables) {
    let count = 0
    if (table === 'households') {
      const { count: c } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('owner_id', targetUserId)
      count = c ?? 0
    } else if ((HOUSEHOLD_ONLY_TABLES as readonly string[]).includes(table)) {
      const { count: c } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('household_id', targetHouseholdId)
      count = c ?? 0
    } else if ((USER_ONLY_TABLES as readonly string[]).includes(table)) {
      const { count: c } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', targetUserId)
      count = c ?? 0
    } else {
      const { count: c } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('owner_id', targetUserId)
      count = c ?? 0
    }
    console.log(`- ${table}: ${count}`)
  }

  console.log('\nPlanning data clone complete.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
