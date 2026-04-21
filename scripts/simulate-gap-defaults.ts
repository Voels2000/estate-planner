import { config as loadEnv } from 'dotenv'
import { createAdminClient } from '../lib/supabase/admin'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env.vercel.local' })

const EMAIL = 'avoels@outlook.com'

type Person = { id: string; full_name: string; relationship: string; is_gst_skip: boolean; date_of_birth: string | null }
type Ben = { beneficiary_type: 'primary' | 'contingent'; full_name: string; asset_id: string | null; real_estate_id: string | null; insurance_policy_id: string | null; business_id: string | null; allocation_pct: number }

const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
const isDesc = (r: string) => /\b(son|daughter|child|children|kid|stepchild|step-son|step-daughter)\b/i.test(r) || /grand|grandchild|grandson|granddaughter/i.test(r)
const childOnly = (r: string) => ((/child/i.test(r) && !/grandchild/i.test(r)) || (/son/i.test(r) && !/grandson/i.test(r)) || (/daughter/i.test(r) && !/granddaughter/i.test(r)))

function suggest(owner: string | null, hasSpouse: boolean, p1: string | null, p2: string | null, descendants: Person[]) {
  const firstChild = descendants[0]?.full_name?.trim() ?? null
  if (owner === 'person1' && hasSpouse && p2?.trim()) return p2.trim()
  if (owner === 'person2' && hasSpouse && p1?.trim()) return p1.trim()
  if (owner === 'joint' && hasSpouse && p2?.trim()) return p2.trim()
  if ((!owner || owner === '') && hasSpouse && p2?.trim()) return p2.trim()
  return firstChild
}

function remPct(rows: Ben[], kind: 'asset'|'re'|'insurance'|'business', id: string, type: 'primary'|'contingent') {
  const f = rows.filter(b => b.beneficiary_type===type && (kind==='asset'?b.asset_id===id:kind==='re'?b.real_estate_id===id:kind==='insurance'?b.insurance_policy_id===id:b.business_id===id))
  return Math.max(0, 100 - f.reduce((s,b)=>s+Number(b.allocation_pct||0),0))
}

async function main() {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id').eq('email', EMAIL).single()
  const uid = profile.id
  const { data: h } = await admin.from('households').select('id,person1_name,person2_name,has_spouse').eq('owner_id', uid).single()
  const [{data:assets},{data:re},{data:ins},{data:biz},{data:hp},{data:bens}] = await Promise.all([
    admin.from('assets').select('id,name,owner').eq('owner_id', uid),
    admin.from('real_estate').select('id,name,owner').eq('owner_id', uid),
    admin.from('insurance_policies').select('id,policy_name').eq('user_id', uid),
    admin.from('businesses').select('id,name').eq('owner_id', uid),
    admin.from('household_people').select('id,full_name,relationship,is_gst_skip,date_of_birth').eq('household_id', h.id),
    admin.from('asset_beneficiaries').select('beneficiary_type,full_name,asset_id,real_estate_id,insurance_policy_id,business_id,allocation_pct').eq('owner_id', uid),
  ])
  const people = (hp ?? []) as Person[]
  const descendants = people.filter(p=>isDesc(p.relationship))
  const children = people.filter(p=>childOnly(p.relationship))
  let working = [...((bens ?? []) as Ben[])]
  let planned = 0
  let unresolved = 0
  const applyItem = (kind:'asset'|'re'|'insurance'|'business', id:string, owner:string|null) => {
    const hasP = working.some(b=>b.beneficiary_type==='primary' && (kind==='asset'?b.asset_id===id:kind==='re'?b.real_estate_id===id:kind==='insurance'?b.insurance_policy_id===id:b.business_id===id))
    const hasC = working.some(b=>b.beneficiary_type==='contingent' && (kind==='asset'?b.asset_id===id:kind==='re'?b.real_estate_id===id:kind==='insurance'?b.insurance_policy_id===id:b.business_id===id))
    if (!hasP) {
      const nm = suggest(owner, h.has_spouse===true, h.person1_name, h.person2_name, descendants)
      if (!nm) unresolved++
      else {
        const rem = remPct(working, kind, id, 'primary')
        if (rem>0.01) { planned++; working.push({beneficiary_type:'primary',full_name:nm,asset_id:kind==='asset'?id:null,real_estate_id:kind==='re'?id:null,insurance_policy_id:kind==='insurance'?id:null,business_id:kind==='business'?id:null,allocation_pct:rem}) }
      }
    }
    if (!hasC) {
      if (children.length>0) {
        const split = Math.round(10000/children.length)/100
        for (const c of children) {
          const already = working.some(b=>b.beneficiary_type==='contingent' && (kind==='asset'?b.asset_id===id:kind==='re'?b.real_estate_id===id:kind==='insurance'?b.insurance_policy_id===id:b.business_id===id) && normalize(b.full_name)===normalize(c.full_name))
          if (already) continue
          planned++
          working.push({beneficiary_type:'contingent',full_name:c.full_name,asset_id:kind==='asset'?id:null,real_estate_id:kind==='re'?id:null,insurance_policy_id:kind==='insurance'?id:null,business_id:kind==='business'?id:null,allocation_pct:split})
        }
      } else unresolved++
    }
  }
  for (const a of assets ?? []) applyItem('asset', a.id, a.owner ?? null)
  for (const r of re ?? []) applyItem('re', r.id, r.owner ?? null)
  for (const i of ins ?? []) applyItem('insurance', i.id, null)
  for (const b of biz ?? []) applyItem('business', b.id, null)
  console.log({ planned_inserts: planned, unresolved_items: unresolved, children: children.map(c=>c.full_name) })
}

main().catch((e)=>{console.error(e);process.exit(1)})

