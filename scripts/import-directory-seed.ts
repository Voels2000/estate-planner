/**
 * import-directory-seed.ts
 *
 * Dry-run by default. Ref-guarded. Parses outreach spreadsheets → directory tables.
 *
 *   SUPABASE_DB_REF=cmzyxpxfyvdvbsykjvsg SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/import-directory-seed.ts --state WA
 *
 *   ...same... --commit
 *
 * Re-import upserts unclaimed rows only (claimed_at IS NULL). Does not touch
 * outreach_sent_at / outreach_send_count / outreach_reminder_sent_at.
 */

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import {
  buildAdvisorDirectorySeedPayload,
  buildAttorneyListingSeedPayload,
  DIRECTORY_SEED_PRESERVED_LISTING_FIELDS,
  extractCredentials,
  extractSpecializations,
  parseCrdNumber,
  parseEmailWebsite,
  parseWsbaBarNumber,
  type DirectorySeedParsedRow,
} from '@/lib/directory/directorySeedImport'

const REFS: Record<string, 'staging' | 'production'> = {
  cmzyxpxfyvdvbsykjvsg: 'staging',
  fnzvlmrqwcqwiqueevux: 'production',
}

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
])

function fail(msg: string): never {
  console.error(`\n[FATAL] ${msg}\n`)
  process.exit(1)
}

function parseArgs(argv: string[]) {
  let attorneysPath = './data/directory-seed/MWM_Attorney_Directory_Seed.xlsx'
  let advisorsPath = './data/directory-seed/MWM_Advisor_Directory_Seed.xlsx'
  let stateFlag: string | null = null
  let commit = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--commit') commit = true
    else if (a === '--attorneys') attorneysPath = argv[++i] ?? fail('--attorneys requires a path')
    else if (a === '--advisors') advisorsPath = argv[++i] ?? fail('--advisors requires a path')
    else if (a === '--state') stateFlag = (argv[++i] ?? fail('--state requires a value')).toUpperCase()
    else if (a.startsWith('--')) fail(`Unknown flag: ${a}`)
  }

  return { attorneysPath, advisorsPath, stateFlag, commit }
}

function isLegendRow(values: string): boolean {
  return (
    /^FLAGS:/i.test(values) ||
    /^(HIGH PRIORITY|MEDIUM PRIORITY|TOTAL:)/i.test(values) ||
    /^Source:/i.test(values) ||
    /^VERIFICATION:/i.test(values) ||
    /^\s*GREEN rows/i.test(values) ||
    /^\s*WHITE rows/i.test(values) ||
    /FINRA BrokerCheck verification/i.test(values)
  )
}

function naturalKey(firm: string, contact: string, state: string): string {
  return `${firm.trim().toLowerCase()}|${contact.trim().toLowerCase()}|${state.toUpperCase()}`
}

function maskEmail(v: string): string {
  const [local, domain] = v.split('@')
  return `${local.slice(0, 2)}***@${domain}`
}

function maskPhone(v: string | null): string {
  if (!v) return '—'
  return v.replace(/\d(?=\d{2})/g, '•')
}

function newClaimToken(): string {
  return randomBytes(24).toString('base64url')
}

function parseAttorneySheet(path: string, defaultState: string | null): DirectorySeedParsedRow[] {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], {
    range: 3,
    defval: '',
  })

  const out: DirectorySeedParsedRow[] = []
  for (const row of rows) {
    const name = String(row.Name ?? '').trim()
    const firm = String(row.Firm ?? '').trim()
    const pri = String(row['Outreach Priority'] ?? '')
    if (!name && !firm) continue
    if (isLegendRow(`${name}${firm}${pri}`)) continue

    const stateCol = String(row.State ?? row.state ?? '').trim().toUpperCase()
    const state = stateCol || defaultState
    if (!state) fail(`Attorney row "${name}" missing state — pass --state`)
    if (!US_STATES.has(state)) fail(`Unrecognized state "${state}" for attorney "${name}"`)

    const notes = String(row['Credential / Notes'] ?? '').trim()
    const wsbaColumn = String(row['WSBA #'] ?? '').trim()
    const { email, website } = parseEmailWebsite(String(row['Email / Website'] ?? ''))

    out.push({
      kind: 'attorney',
      contact_name: name,
      firm_name: firm,
      city: String(row.City ?? '').trim() || null,
      state,
      email,
      website,
      phone: String(row.Phone ?? '').trim() || null,
      bio: notes || null,
      credentials: extractCredentials(notes),
      specializations: extractSpecializations(notes),
      bar_number: parseWsbaBarNumber(wsbaColumn, notes),
      crd_number: null,
      adv_link: null,
    })
  }
  return out
}

function parseAdvisorSheet(path: string, defaultState: string | null): DirectorySeedParsedRow[] {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], {
    range: 3,
    defval: '',
  })

  const out: DirectorySeedParsedRow[] = []
  for (const row of rows) {
    const name = String(row['Lead Advisor'] ?? '').trim()
    const firm = String(row.Firm ?? '').trim()
    const pri = String(row['Outreach Priority'] ?? '')
    if (!name && !firm) continue
    if (isLegendRow(`${name}${firm}${pri}`)) continue

    const stateCol = String(row.State ?? row.state ?? '').trim().toUpperCase()
    const state = stateCol || defaultState
    if (!state) fail(`Advisor row "${name}" missing state — pass --state`)
    if (!US_STATES.has(state)) fail(`Unrecognized state "${state}" for advisor "${name}"`)

    const notes = String(row['Credentials / Notes'] ?? '').trim()
    const crdColumn = String(row['CRD #'] ?? '').trim()
    const websiteRaw = String(row.Website ?? '').trim()
    const { email, website } = parseEmailWebsite(websiteRaw)

    out.push({
      kind: 'advisor',
      contact_name: name,
      firm_name: firm,
      city: String(row.City ?? '').trim() || null,
      state,
      email,
      website,
      phone: String(row.Phone ?? '').trim() || null,
      bio: notes || null,
      credentials: extractCredentials(notes),
      specializations: extractSpecializations(notes),
      bar_number: null,
      crd_number: parseCrdNumber(crdColumn, notes),
      adv_link: website,
    })
  }
  return out
}

async function main() {
  const { attorneysPath, advisorsPath, stateFlag, commit } = parseArgs(process.argv.slice(2))

  const dbRef = process.env.SUPABASE_DB_REF ?? ''
  const supabaseUrl = process.env.SUPABASE_URL ?? ''
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!dbRef) fail('SUPABASE_DB_REF not set.')
  const env = REFS[dbRef]
  if (!env) fail(`Unknown SUPABASE_DB_REF "${dbRef}". Expected staging or prod ref.`)
  if (!supabaseUrl || !serviceRole) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.')
  if (!supabaseUrl.includes(dbRef)) {
    fail(`SUPABASE_URL does not contain ref "${dbRef}". Refusing mismatched project.`)
  }

  const attorneys = parseAttorneySheet(attorneysPath, stateFlag)
  const advisors = parseAdvisorSheet(advisorsPath, stateFlag)
  const allRows = [...attorneys, ...advisors]

  const stateBreakdown: Record<string, { attorneys: number; advisors: number }> = {}
  for (const row of allRows) {
    stateBreakdown[row.state] ??= { attorneys: 0, advisors: 0 }
    if (row.kind === 'attorney') stateBreakdown[row.state].attorneys++
    else stateBreakdown[row.state].advisors++
  }

  console.log('='.repeat(70))
  console.log(`DIRECTORY SEED IMPORT — ${env.toUpperCase()} (${dbRef})`)
  console.log(`Mode: ${commit ? 'COMMIT' : 'DRY RUN'}  ${new Date().toISOString()}`)
  console.log(
    `Preserved on re-import (not in upsert payload): ${DIRECTORY_SEED_PRESERVED_LISTING_FIELDS.join(', ')}`,
  )
  console.log('='.repeat(70))
  console.log('\nPer-state breakdown:')
  for (const [st, counts] of Object.entries(stateBreakdown).sort()) {
    console.log(`  ${st}: ${counts.attorneys} attorneys, ${counts.advisors} advisors`)
  }
  console.log(`\nTotal: ${attorneys.length} attorneys, ${advisors.length} advisors`)

  const withBar = attorneys.filter((r) => r.bar_number)
  const withCrd = advisors.filter((r) => r.crd_number)
  console.log(`\nParsed credentials: ${withBar.length}/${attorneys.length} attorneys with bar_number`)
  console.log(`Parsed credentials: ${withCrd.length}/${advisors.length} advisors with crd_number`)

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })

  const [{ data: existingAttorneys }, { data: existingAdvisors }] = await Promise.all([
    admin.from('attorney_listings').select('id, firm_name, contact_name, state, claim_token, profile_id, claimed_at, source'),
    admin.from('advisor_directory').select('id, firm_name, contact_name, state, claim_token, profile_id, claimed_at, source'),
  ])

  const attIndex = new Map(
    (existingAttorneys ?? []).map((r) => [
      naturalKey(String(r.firm_name ?? ''), String(r.contact_name ?? ''), String(r.state ?? '')),
      r,
    ]),
  )
  const advIndex = new Map(
    (existingAdvisors ?? []).map((r) => [
      naturalKey(String(r.firm_name ?? ''), String(r.contact_name ?? ''), String(r.state ?? '')),
      r,
    ]),
  )

  let attInsert = 0
  let attUpdate = 0
  let advInsert = 0
  let advUpdate = 0

  console.log('\nSample mapped rows (PII masked):')
  for (const row of allRows.slice(0, 3)) {
    const cred =
      row.kind === 'attorney'
        ? `bar=${row.bar_number ?? '—'}`
        : `crd=${row.crd_number ?? '—'}`
    console.log(
      `  [${row.kind}] ${row.contact_name} @ ${row.firm_name} (${row.state}) email=${maskEmail(row.email)} phone=${maskPhone(row.phone)} ${cred} credentials=${row.credentials.join(',') || '—'}`,
    )
  }

  if (!commit) {
    for (const row of attorneys) {
      const key = naturalKey(row.firm_name, row.contact_name, row.state)
      if (attIndex.has(key)) attUpdate++
      else attInsert++
    }
    for (const row of advisors) {
      const key = naturalKey(row.firm_name, row.contact_name, row.state)
      if (advIndex.has(key)) advUpdate++
      else advInsert++
    }
    console.log(`\nWould insert ${attInsert} attorneys, update ${attUpdate} attorneys`)
    console.log(`Would insert ${advInsert} advisors, update ${advUpdate} advisors`)
    console.log('\nNo changes written (dry run). Re-run with --commit.')
    return
  }

  for (const row of attorneys) {
    const key = naturalKey(row.firm_name, row.contact_name, row.state)
    const existing = attIndex.get(key)
    const token = existing?.claim_token ?? newClaimToken()
    const payload = buildAttorneyListingSeedPayload(row, {
      claimToken: token,
      existingProfileId: existing?.profile_id ?? null,
      setTokenCreatedAt: !existing?.claim_token,
    })

    if (existing?.id) {
      const { error } = await admin
        .from('attorney_listings')
        .update(payload)
        .eq('id', existing.id)
        .is('claimed_at', null)
      if (error) fail(`Attorney update failed (${row.contact_name}): ${error.message}`)
      attUpdate++
    } else {
      const { error } = await admin.from('attorney_listings').insert(payload)
      if (error) fail(`Attorney insert failed (${row.contact_name}): ${error.message}`)
      attInsert++
    }
  }

  for (const row of advisors) {
    const key = naturalKey(row.firm_name, row.contact_name, row.state)
    const existing = advIndex.get(key)
    const token = existing?.claim_token ?? newClaimToken()
    const payload = buildAdvisorDirectorySeedPayload(row, {
      claimToken: token,
      existingProfileId: existing?.profile_id ?? null,
      setTokenCreatedAt: !existing?.claim_token,
    })

    if (existing?.id) {
      const { error } = await admin
        .from('advisor_directory')
        .update(payload)
        .eq('id', existing.id)
        .is('claimed_at', null)
      if (error) fail(`Advisor update failed (${row.contact_name}): ${error.message}`)
      advUpdate++
    } else {
      const { error } = await admin.from('advisor_directory').insert(payload)
      if (error) fail(`Advisor insert failed (${row.contact_name}): ${error.message}`)
      advInsert++
    }
  }

  console.log(`\nCommitted: ${attInsert} attorney inserts, ${attUpdate} attorney updates`)
  console.log(`Committed: ${advInsert} advisor inserts, ${advUpdate} advisor updates`)
  console.log('\nRollback (unclaimed seed only):')
  console.log("  delete from attorney_listings where source='outreach_seed' and claimed_at is null;")
  console.log("  delete from advisor_directory where source='outreach_seed' and claimed_at is null;")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
