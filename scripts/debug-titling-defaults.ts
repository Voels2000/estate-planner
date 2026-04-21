import { config as loadEnv } from 'dotenv'
import { createAdminClient } from '../lib/supabase/admin'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env.vercel.local' })

const EMAIL = 'avoels@outlook.com'

type Ben = {
  id: string
  asset_id: string | null
  real_estate_id: string | null
  insurance_policy_id: string | null
  business_id: string | null
  beneficiary_type: 'primary' | 'contingent'
  full_name: string
  allocation_pct: number
}

function sumPct(rows: Ben[]) {
  return rows.reduce((s, r) => s + Number(r.allocation_pct || 0), 0)
}

async function main() {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id').eq('email', EMAIL).maybeSingle()
  if (!profile?.id) throw new Error(`No user for ${EMAIL}`)
  const userId = profile.id

  const [{ data: assets }, { data: re }, { data: ins }, { data: biz }, { data: bens }] = await Promise.all([
    admin.from('assets').select('id,name,owner').eq('owner_id', userId),
    admin.from('real_estate').select('id,name').eq('owner_id', userId),
    admin.from('insurance_policies').select('id,policy_name').eq('user_id', userId),
    admin.from('businesses').select('id,name').eq('owner_id', userId),
    admin
      .from('asset_beneficiaries')
      .select('id,asset_id,real_estate_id,insurance_policy_id,business_id,beneficiary_type,full_name,allocation_pct')
      .eq('owner_id', userId),
  ])

  const benRows = (bens ?? []) as Ben[]

  function report(kind: 'asset' | 're' | 'insurance' | 'business', id: string, label: string) {
    const rows = benRows.filter((b) =>
      kind === 'asset' ? b.asset_id === id : kind === 're' ? b.real_estate_id === id : kind === 'insurance' ? b.insurance_policy_id === id : b.business_id === id,
    )
    const p = rows.filter((r) => r.beneficiary_type === 'primary')
    const c = rows.filter((r) => r.beneficiary_type === 'contingent')
    const pSum = sumPct(p)
    const cSum = sumPct(c)
    const missing = p.length === 0 || c.length === 0
    if (missing || pSum > 100.01 || cSum > 100.01) {
      console.log(`${kind}:${label}`)
      console.log(`  primary count=${p.length} sum=${pSum.toFixed(2)}`)
      console.log(`  contingent count=${c.length} sum=${cSum.toFixed(2)}`)
    }
  }

  console.log(`User ${EMAIL} (${userId})`)
  console.log(`assets=${assets?.length ?? 0} re=${re?.length ?? 0} insurance=${ins?.length ?? 0} business=${biz?.length ?? 0} beneficiaries=${benRows.length}`)
  console.log('\nPotential problem rows:')
  for (const a of assets ?? []) report('asset', a.id, a.name)
  for (const x of re ?? []) report('re', x.id, x.name)
  for (const x of ins ?? []) report('insurance', x.id, x.policy_name ?? 'Insurance policy')
  for (const x of biz ?? []) report('business', x.id, x.name)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

