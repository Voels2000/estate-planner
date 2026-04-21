import { config as loadEnv } from 'dotenv'
import { createAdminClient } from '../lib/supabase/admin'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env.vercel.local' })

const SOURCE_EMAIL = 'avoels@comcast.net'
const TARGET_EMAIL = 'avoels@outlook.com'

type Row = Record<string, unknown>

function stripManaged(row: Row): Row {
  const out = { ...row }
  delete out.id
  delete out.created_at
  delete out.updated_at
  return out
}

function signature(row: Row, drop: string[] = []): string {
  const ignore = new Set([
    'id',
    'created_at',
    'updated_at',
    'owner_id',
    'user_id',
    'household_id',
    ...drop,
  ])
  const entries = Object.entries(row)
    .filter(([k]) => !ignore.has(k))
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(entries)
}

async function copyByKey(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  sourceKey: string,
  sourceId: string,
  targetKey: string,
  targetId: string
) {
  await admin.from(table).delete().eq(targetKey, targetId)
  const { data: sourceRows, error } = await admin.from(table).select('*').eq(sourceKey, sourceId)
  if (error) throw new Error(`${table} select failed: ${error.message}`)
  const rows = (sourceRows ?? []).map((r) => {
    const out = stripManaged(r as Row)
    out[targetKey] = targetId
    if (sourceKey !== targetKey) delete out[sourceKey]
    return out
  })
  if (!rows.length) return 0
  const { error: insertError } = await admin.from(table).insert(rows)
  if (insertError) throw new Error(`${table} insert failed: ${insertError.message}`)
  return rows.length
}

async function main() {
  const admin = createAdminClient()

  const { data: sourceProfile } = await admin.from('profiles').select('id').eq('email', SOURCE_EMAIL).maybeSingle()
  const { data: targetProfile } = await admin.from('profiles').select('id').eq('email', TARGET_EMAIL).maybeSingle()
  if (!sourceProfile?.id || !targetProfile?.id) throw new Error('Missing source or target profile')

  const sourceUserId = sourceProfile.id
  const targetUserId = targetProfile.id

  const { data: sourceHousehold } = await admin.from('households').select('*').eq('owner_id', sourceUserId).maybeSingle()
  const { data: targetHousehold } = await admin.from('households').select('*').eq('owner_id', targetUserId).maybeSingle()
  if (!sourceHousehold?.id || !targetHousehold?.id) throw new Error('Missing source or target household')

  const sourceHouseholdId = sourceHousehold.id as string
  const targetHouseholdId = targetHousehold.id as string

  // 1) Make household payload match source (without replacing PK/owner).
  const householdUpdate = stripManaged(sourceHousehold as Row)
  householdUpdate.owner_id = targetUserId
  householdUpdate.updated_at = new Date().toISOString()
  const { error: hhErr } = await admin.from('households').update(householdUpdate).eq('id', targetHouseholdId)
  if (hhErr) throw new Error(`households update failed: ${hhErr.message}`)
  console.log('Updated household content to source values.')

  // 2) Recopy insurance policies by user_id (not owner_id).
  const insuranceCopied = await copyByKey(admin, 'insurance_policies', 'user_id', sourceUserId, 'user_id', targetUserId)
  console.log(`Copied insurance_policies: ${insuranceCopied}`)

  // 3) Build asset ID map by content signature.
  const { data: sourceAssets } = await admin.from('assets').select('*').eq('owner_id', sourceUserId)
  const { data: targetAssets } = await admin.from('assets').select('*').eq('owner_id', targetUserId)
  const sourceAssetRows = (sourceAssets ?? []) as Row[]
  const targetAssetRows = (targetAssets ?? []) as Row[]

  const targetBuckets = new Map<string, Row[]>()
  for (const row of targetAssetRows) {
    const sig = signature(row)
    targetBuckets.set(sig, [...(targetBuckets.get(sig) ?? []), row])
  }
  const assetIdMap = new Map<string, string>()
  for (const row of sourceAssetRows) {
    const sig = signature(row)
    const bucket = targetBuckets.get(sig) ?? []
    const match = bucket.shift()
    if (match?.id && row.id) assetIdMap.set(String(row.id), String(match.id))
    targetBuckets.set(sig, bucket)
  }

  // 4) Recopy asset_titling and remap asset_id to target assets.
  await admin.from('asset_titling').delete().eq('owner_id', targetUserId)
  const { data: sourceTitling, error: stErr } = await admin.from('asset_titling').select('*').eq('owner_id', sourceUserId)
  if (stErr) throw new Error(`asset_titling select failed: ${stErr.message}`)
  const titlingRows = ((sourceTitling ?? []) as Row[])
    .map((r) => {
      const out = stripManaged(r)
      out.owner_id = targetUserId
      const sourceAssetId = String(r.asset_id ?? '')
      const mappedAssetId = assetIdMap.get(sourceAssetId)
      if (!mappedAssetId) return null
      out.asset_id = mappedAssetId
      return out
    })
    .filter((r): r is Row => r !== null)
  if (titlingRows.length) {
    const { error: atErr } = await admin.from('asset_titling').insert(titlingRows)
    if (atErr) throw new Error(`asset_titling insert failed: ${atErr.message}`)
  }
  console.log(`Copied asset_titling: ${titlingRows.length}`)

  // 5) Household-keyed scenario/result/score tables.
  const scenariosCopied = await copyByKey(
    admin,
    'projection_scenarios',
    'household_id',
    sourceHouseholdId,
    'household_id',
    targetHouseholdId
  )
  console.log(`Copied projection_scenarios: ${scenariosCopied}`)

  const monteCopied = await copyByKey(
    admin,
    'monte_carlo_results',
    'household_id',
    sourceHouseholdId,
    'household_id',
    targetHouseholdId
  )
  console.log(`Copied monte_carlo_results: ${monteCopied}`)

  const scoresCopied = await copyByKey(
    admin,
    'estate_health_scores',
    'household_id',
    sourceHouseholdId,
    'household_id',
    targetHouseholdId
  )
  console.log(`Copied estate_health_scores: ${scoresCopied}`)

  console.log('Repair pass complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

