/**
 * Compare avoels@comcast.net (advisor) vs avoels@outlook.com (consumer).
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) process.exit(1)

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const COMCAST = '854051be-3aac-4d43-8062-df414a7055e1'
const OUTLOOK = 'dbff0d6c-4b8c-46f5-b8fc-5925b8e6bd93'

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

async function main() {
  const [{ data: aAssets }, { data: bAssets }, { data: aRE }, { data: bRE }, { data: aBiz }, { data: bBiz }, { data: aIns }, { data: bIns }, { data: hhA }, { data: hhB }] =
    await Promise.all([
      admin.from('assets').select('id, name, type, value, owner, updated_at').eq('owner_id', COMCAST).order('name'),
      admin.from('assets').select('id, name, type, value, owner, updated_at').eq('owner_id', OUTLOOK).order('name'),
      admin.from('real_estate').select('name, current_value, mortgage_balance').eq('owner_id', COMCAST),
      admin.from('real_estate').select('name, current_value, mortgage_balance').eq('owner_id', OUTLOOK),
      admin.from('businesses').select('name, estimated_value, ownership_pct').eq('owner_id', COMCAST),
      admin.from('businesses').select('name, estimated_value, ownership_pct').eq('owner_id', OUTLOOK),
      admin.from('insurance_policies').select('policy_name, death_benefit, is_ilit').eq('user_id', COMCAST),
      admin.from('insurance_policies').select('policy_name, death_benefit, is_ilit').eq('user_id', OUTLOOK),
      admin.from('households').select('id, name, filing_status, state_primary, has_spouse, updated_at, base_case_scenario_id').eq('owner_id', COMCAST).single(),
      admin.from('households').select('id, name, filing_status, state_primary, has_spouse, updated_at, base_case_scenario_id').eq('owner_id', OUTLOOK).single(),
    ])

  const [{ data: compA }, { data: compB }, { data: cacheA }, { data: cacheB }] = await Promise.all([
    admin.rpc('calculate_estate_composition', { p_household_id: hhA!.id }),
    admin.rpc('calculate_estate_composition', { p_household_id: hhB!.id }),
    admin.from('estate_composition_cache').select('gross_estate, computed_at').eq('household_id', hhA!.id).maybeSingle(),
    admin.from('estate_composition_cache').select('gross_estate, computed_at').eq('household_id', hhB!.id).maybeSingle(),
  ])

  const mapA = new Map((aAssets ?? []).map((a) => [a.name, a]))
  const mapB = new Map((bAssets ?? []).map((a) => [a.name, a]))
  const allNames = new Set([...mapA.keys(), ...mapB.keys()])

  console.log('\n=== PROFILE / HOUSEHOLD ===')
  console.log('comcast (advisor): My Plan household', hhA?.id)
  console.log('outlook (consumer): Voels Household', hhB?.id)
  console.log('Active advisor link: comcast advises outlook client')

  console.log('\n=== TOTALS ===')
  const sum = (rows: Array<Record<string, unknown>>, k: string) =>
    rows.reduce((s, r) => s + Number(r[k] ?? 0), 0)

  const aAssetTotal = sum(aAssets ?? [], 'value')
  const bAssetTotal = sum(bAssets ?? [], 'value')
  console.log(`Financial assets:  comcast ${fmt(aAssetTotal)} | outlook ${fmt(bAssetTotal)} | Δ ${fmt(bAssetTotal - aAssetTotal)}`)
  console.log(`Real estate:       comcast ${fmt(sum(aRE ?? [], 'current_value'))} | outlook ${fmt(sum(bRE ?? [], 'current_value'))} | Δ ${fmt(sum(bRE ?? [], 'current_value') - sum(aRE ?? [], 'current_value'))}`)
  console.log(`Business FMV:      comcast ${fmt(sum(aBiz ?? [], 'estimated_value'))} | outlook ${fmt(sum(bBiz ?? [], 'estimated_value'))} | Δ ${fmt(sum(bBiz ?? [], 'estimated_value') - sum(aBiz ?? [], 'estimated_value'))}`)
  console.log(`Insurance DB:      comcast ${fmt(sum(aIns ?? [], 'death_benefit'))} | outlook ${fmt(sum(bIns ?? [], 'death_benefit'))} | Δ ${fmt(sum(bIns ?? [], 'death_benefit') - sum(aIns ?? [], 'death_benefit'))}`)
  console.log(`Composition gross: comcast ${fmt(Number(compA?.gross_estate ?? 0))} | outlook ${fmt(Number(compB?.gross_estate ?? 0))} | Δ ${fmt(Number(compB?.gross_estate ?? 0) - Number(compA?.gross_estate ?? 0))}`)
  console.log(`Composition cache: comcast ${cacheA ? fmt(Number(cacheA.gross_estate)) + ' @ ' + cacheA.computed_at : 'none'} | outlook ${cacheB ? fmt(Number(cacheB.gross_estate)) + ' @ ' + cacheB.computed_at : 'none'}`)

  console.log('\n=== ASSET-BY-ASSET VALUE DIFFS ===')
  let assetDelta = 0
  for (const name of [...allNames].sort()) {
    const a = mapA.get(name)
    const b = mapB.get(name)
    const va = Number(a?.value ?? 0)
    const vb = Number(b?.value ?? 0)
    if (!a || !b) {
      console.log(`  ONLY IN ${!a ? 'outlook' : 'comcast'}: ${name} = ${fmt(!a ? vb : va)}`)
      assetDelta += vb - va
      continue
    }
    if (Math.abs(va - vb) > 0.01) {
      console.log(`  ${name} [${a.type}]: comcast ${fmt(va)} → outlook ${fmt(vb)} (Δ ${fmt(vb - va)})`)
      assetDelta += vb - va
    }
  }
  if (assetDelta === 0) console.log('  (no per-asset value differences — same names/values)')
  else console.log(`\n  Net asset row delta: ${fmt(assetDelta)}`)

  // IDs differ?
  const sameNames = [...allNames].filter((n) => mapA.has(n) && mapB.has(n))
  const idMismatches = sameNames.filter((n) => mapA.get(n)!.id !== mapB.get(n)!.id)
  if (idMismatches.length) {
    console.log(`\n=== NOTE: ${idMismatches.length} assets share names but have different row IDs (duplicated datasets, not synced) ===`)
  }
}

main().catch(console.error)
