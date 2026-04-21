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

function assetSignature(row: Row): string {
  const copy = { ...row }
  delete copy.id
  delete copy.owner_id
  delete copy.created_at
  delete copy.updated_at
  const keys = Object.keys(copy).sort()
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, copy[k]])))
}

function pushMap(map: Map<string, string[]>, key: string, value: string) {
  const arr = map.get(key) ?? []
  arr.push(value)
  map.set(key, arr)
}

function genericSignature(row: Row, remove: string[]): string {
  const copy = { ...row }
  for (const key of remove) delete copy[key]
  const keys = Object.keys(copy).sort()
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, copy[k]])))
}

async function deleteByEq(admin: ReturnType<typeof createAdminClient>, table: string, col: string, value: string) {
  const { error } = await admin.from(table).delete().eq(col, value)
  if (error) throw new Error(`Delete failed ${table}.${col}: ${error.message}`)
}

async function main() {
  const admin = createAdminClient()

  const { data: srcProfile } = await admin.from('profiles').select('id').eq('email', SOURCE_EMAIL).maybeSingle()
  const { data: tgtProfile } = await admin.from('profiles').select('id').eq('email', TARGET_EMAIL).maybeSingle()
  if (!srcProfile?.id || !tgtProfile?.id) throw new Error('Source or target profile not found.')

  const sourceUserId = srcProfile.id
  const targetUserId = tgtProfile.id

  const { data: srcHousehold } = await admin.from('households').select('*').eq('owner_id', sourceUserId).maybeSingle()
  const { data: tgtHousehold } = await admin.from('households').select('*').eq('owner_id', targetUserId).maybeSingle()
  if (!srcHousehold?.id || !tgtHousehold?.id) throw new Error('Source or target household not found.')

  const sourceHouseholdId = String(srcHousehold.id)
  const targetHouseholdId = String(tgtHousehold.id)

  // 1) Align household values (keep target id/owner).
  const householdPatch = stripManaged(srcHousehold as Row)
  householdPatch.owner_id = targetUserId
  householdPatch.updated_at = new Date().toISOString()
  const { error: hhUpdateError } = await admin.from('households').update(householdPatch).eq('id', targetHouseholdId)
  if (hhUpdateError) throw new Error(`households update failed: ${hhUpdateError.message}`)

  // 2) insurance_policies: delete target and copy source keyed by user_id.
  await deleteByEq(admin, 'insurance_policies', 'user_id', targetUserId)
  const { data: srcInsurance, error: srcInsuranceError } = await admin
    .from('insurance_policies')
    .select('*')
    .eq('user_id', sourceUserId)
  if (srcInsuranceError) throw new Error(`insurance_policies read failed: ${srcInsuranceError.message}`)
  if (srcInsurance && srcInsurance.length) {
    const insRows = srcInsurance.map((r) => {
      const out = stripManaged(r as Row)
      out.user_id = targetUserId
      if (Object.prototype.hasOwnProperty.call(out, 'household_id')) out.household_id = targetHouseholdId
      return out
    })
    const { error } = await admin.from('insurance_policies').insert(insRows)
    if (error) throw new Error(`insurance_policies insert failed: ${error.message}`)
  }

  // 3) scenario/result/score tables by household_id.
  const householdTables = ['projection_scenarios', 'monte_carlo_results', 'estate_health_scores'] as const
  for (const table of householdTables) {
    await deleteByEq(admin, table, 'household_id', targetHouseholdId)
    const { data: srcRows, error: srcErr } = await admin.from(table).select('*').eq('household_id', sourceHouseholdId)
    if (srcErr) throw new Error(`${table} read failed: ${srcErr.message}`)
    if (srcRows && srcRows.length) {
      const rows = srcRows.map((r) => {
        const out = stripManaged(r as Row)
        out.household_id = targetHouseholdId
        if (Object.prototype.hasOwnProperty.call(out, 'owner_id')) out.owner_id = targetUserId
        if (Object.prototype.hasOwnProperty.call(out, 'user_id')) out.user_id = targetUserId
        return out
      })
      const { error } = await admin.from(table).insert(rows)
      if (error) throw new Error(`${table} insert failed: ${error.message}`)
    }
  }

  // 4) asset_titling with asset_id remap from source asset ids -> target asset ids.
  const { data: srcAssets, error: srcAssetsError } = await admin.from('assets').select('*').eq('owner_id', sourceUserId)
  const { data: tgtAssets, error: tgtAssetsError } = await admin.from('assets').select('*').eq('owner_id', targetUserId)
  if (srcAssetsError || tgtAssetsError) {
    throw new Error(`assets read failed: ${srcAssetsError?.message ?? tgtAssetsError?.message}`)
  }

  const targetBySig = new Map<string, string[]>()
  for (const asset of tgtAssets ?? []) {
    if (!asset.id) continue
    pushMap(targetBySig, assetSignature(asset as Row), String(asset.id))
  }

  const sourceToTargetAssetId = new Map<string, string>()
  for (const asset of srcAssets ?? []) {
    if (!asset.id) continue
    const sig = assetSignature(asset as Row)
    const candidates = targetBySig.get(sig) ?? []
    const pick = candidates.shift()
    if (pick) {
      sourceToTargetAssetId.set(String(asset.id), pick)
      targetBySig.set(sig, candidates)
    }
  }

  const { data: srcBusinesses, error: srcBizError } = await admin.from('businesses').select('*').eq('owner_id', sourceUserId)
  const { data: tgtBusinesses, error: tgtBizError } = await admin.from('businesses').select('*').eq('owner_id', targetUserId)
  if (srcBizError || tgtBizError) throw new Error(`businesses read failed: ${srcBizError?.message ?? tgtBizError?.message}`)

  const targetBusinessBySig = new Map<string, string[]>()
  for (const row of tgtBusinesses ?? []) {
    if (!row.id) continue
    pushMap(targetBusinessBySig, genericSignature(row as Row, ['id', 'owner_id', 'created_at', 'updated_at']), String(row.id))
  }
  const sourceToTargetBusinessId = new Map<string, string>()
  for (const row of srcBusinesses ?? []) {
    if (!row.id) continue
    const sig = genericSignature(row as Row, ['id', 'owner_id', 'created_at', 'updated_at'])
    const candidates = targetBusinessBySig.get(sig) ?? []
    const pick = candidates.shift()
    if (pick) {
      sourceToTargetBusinessId.set(String(row.id), pick)
      targetBusinessBySig.set(sig, candidates)
    }
  }

  const { data: srcInsuranceRows, error: srcInsMapErr } = await admin.from('insurance_policies').select('*').eq('user_id', sourceUserId)
  const { data: tgtInsuranceRows, error: tgtInsMapErr } = await admin.from('insurance_policies').select('*').eq('user_id', targetUserId)
  if (srcInsMapErr || tgtInsMapErr) {
    throw new Error(`insurance mapping read failed: ${srcInsMapErr?.message ?? tgtInsMapErr?.message}`)
  }
  const targetInsuranceBySig = new Map<string, string[]>()
  for (const row of tgtInsuranceRows ?? []) {
    if (!row.id) continue
    pushMap(targetInsuranceBySig, genericSignature(row as Row, ['id', 'user_id', 'owner_id', 'household_id', 'created_at', 'updated_at']), String(row.id))
  }
  const sourceToTargetInsuranceId = new Map<string, string>()
  for (const row of srcInsuranceRows ?? []) {
    if (!row.id) continue
    const sig = genericSignature(row as Row, ['id', 'user_id', 'owner_id', 'household_id', 'created_at', 'updated_at'])
    const candidates = targetInsuranceBySig.get(sig) ?? []
    const pick = candidates.shift()
    if (pick) {
      sourceToTargetInsuranceId.set(String(row.id), pick)
      targetInsuranceBySig.set(sig, candidates)
    }
  }

  await deleteByEq(admin, 'asset_titling', 'owner_id', targetUserId)
  const { data: srcTitling, error: srcTitlingError } = await admin
    .from('asset_titling')
    .select('*')
    .eq('owner_id', sourceUserId)
  if (srcTitlingError) throw new Error(`asset_titling read failed: ${srcTitlingError.message}`)

  const titlingRows: Row[] = []
  for (const row of srcTitling ?? []) {
    const srcAssetId = String((row as Row).asset_id ?? '')
    const mappedAssetId = sourceToTargetAssetId.get(srcAssetId)
    if (!mappedAssetId) continue
    const out = stripManaged(row as Row)
    out.owner_id = targetUserId
    out.asset_id = mappedAssetId
    titlingRows.push(out)
  }
  if (titlingRows.length) {
    const { error } = await admin.from('asset_titling').insert(titlingRows)
    if (error) throw new Error(`asset_titling insert failed: ${error.message}`)
  }

  // 5) asset_beneficiaries exact replacement with foreign-key remap.
  await deleteByEq(admin, 'asset_beneficiaries', 'owner_id', targetUserId)
  const { data: srcAssetBens, error: srcAssetBensErr } = await admin
    .from('asset_beneficiaries')
    .select('*')
    .eq('owner_id', sourceUserId)
  if (srcAssetBensErr) throw new Error(`asset_beneficiaries read failed: ${srcAssetBensErr.message}`)
  const assetBeneficiaryRows: Row[] = []
  for (const row of srcAssetBens ?? []) {
    const out = stripManaged(row as Row)
    out.owner_id = targetUserId
    if (Object.prototype.hasOwnProperty.call(out, 'household_id')) out.household_id = targetHouseholdId
    if (Object.prototype.hasOwnProperty.call(out, 'user_id')) out.user_id = targetUserId

    if (out.asset_id) {
      const mapped = sourceToTargetAssetId.get(String(out.asset_id))
      if (mapped) out.asset_id = mapped
    }
    if (out.business_id) {
      const mapped = sourceToTargetBusinessId.get(String(out.business_id))
      if (mapped) out.business_id = mapped
    }
    if (out.insurance_policy_id) {
      const mapped = sourceToTargetInsuranceId.get(String(out.insurance_policy_id))
      if (mapped) out.insurance_policy_id = mapped
    }
    assetBeneficiaryRows.push(out)
  }
  if (assetBeneficiaryRows.length) {
    const { error } = await admin.from('asset_beneficiaries').insert(assetBeneficiaryRows)
    if (error) throw new Error(`asset_beneficiaries insert failed: ${error.message}`)
  }

  // 6) household_alerts and estate_flow_snapshots exact replacement.
  const householdReplaceTables = ['household_alerts', 'estate_flow_snapshots'] as const
  for (const table of householdReplaceTables) {
    await deleteByEq(admin, table, 'household_id', targetHouseholdId)
    const { data: srcRows, error: srcErr } = await admin.from(table).select('*').eq('household_id', sourceHouseholdId)
    if (srcErr) throw new Error(`${table} read failed: ${srcErr.message}`)
    if (srcRows && srcRows.length) {
      const rows = srcRows.map((r) => {
        const out = stripManaged(r as Row)
        out.household_id = targetHouseholdId
        if (Object.prototype.hasOwnProperty.call(out, 'owner_id')) out.owner_id = targetUserId
        if (Object.prototype.hasOwnProperty.call(out, 'user_id')) out.user_id = targetUserId
        return out
      })
      const { error } = await admin.from(table).insert(rows)
      if (error) throw new Error(`${table} insert failed: ${error.message}`)
    }
  }

  console.log('Cleanup clone pass complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

