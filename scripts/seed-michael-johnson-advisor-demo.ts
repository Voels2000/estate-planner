/**
 * Seed "Michael Johnson" demo consumer + household + advisor link + sample rows
 * so /advisor/clients/[clientId] shows a full advisor client view.
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *   - Run migration 20260405120000_advisor_demo_asset_columns.sql if assets lack
 *     owner / account_type (advisor UI groups on account_type).
 *
 * Usage (from repo root):
 *   npx tsx scripts/seed-michael-johnson-advisor-demo.ts
 *
 * Env:
 *   SEED_ADVISOR_EMAIL   — required: advisor login email (profile.role = advisor)
 *   SEED_CLIENT_EMAIL    — optional, default: michael.johnson.demo@local.estate
 *   SEED_DEMO_PASSWORD   — optional password for new auth user (min 8 chars); random if unset
 */

import { createAdminClient } from '../lib/supabase/admin'
import { randomBytes } from 'crypto'

const DEFAULT_CLIENT_EMAIL = 'michael.johnson.demo@local.estate'

function randomPassword(): string {
  return randomBytes(12).toString('base64url') + 'Aa1!'
}

async function main() {
  const advisorEmail = process.env.SEED_ADVISOR_EMAIL?.trim()
  if (!advisorEmail) {
    console.error('Set SEED_ADVISOR_EMAIL to your advisor account email.')
    process.exit(1)
  }

  const clientEmail = (process.env.SEED_CLIENT_EMAIL ?? DEFAULT_CLIENT_EMAIL).trim()
  const demoPassword = process.env.SEED_DEMO_PASSWORD?.trim() || randomPassword()

  const admin = createAdminClient()

  const { data: advisorProfile, error: advisorErr } = await admin
    .from('profiles')
    .select('id, role, email')
    .eq('email', advisorEmail)
    .maybeSingle()

  if (advisorErr || !advisorProfile?.id) {
    console.error('Could not find advisor profile for', advisorEmail, advisorErr?.message)
    process.exit(1)
  }

  if (advisorProfile.role !== 'advisor' && advisorProfile.role !== 'financial_advisor') {
    console.error('User is not an advisor:', advisorProfile.role)
    process.exit(1)
  }

  const advisorId = advisorProfile.id

  let clientId: string

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', clientEmail)
    .maybeSingle()

  let isNewUser = false

  if (existingProfile?.id) {
    clientId = existingProfile.id
    console.log('Using existing profile / auth user:', clientEmail, clientId)
  } else {
    isNewUser = true
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: clientEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Michael Johnson', role: 'consumer' },
    })

    if (createErr || !created.user) {
      console.error('auth.admin.createUser failed:', createErr?.message)
      process.exit(1)
    }

    clientId = created.user.id
    console.log('Created auth user:', clientEmail, clientId)

    const { error: profErr } = await admin.from('profiles').update({
      full_name: 'Michael Johnson',
      subscription_status: 'active',
      consumer_tier: 3,
      updated_at: new Date().toISOString(),
    }).eq('id', clientId)

    if (profErr) console.warn('profiles update after signup:', profErr.message)
  }

  await admin
    .from('profiles')
    .update({
      full_name: 'Michael Johnson',
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  const householdRow = {
    owner_id: clientId,
    name: 'Michael & Sarah Johnson',
    person1_name: 'Michael Johnson',
    person1_first_name: 'Michael',
    person1_last_name: 'Johnson',
    person1_birth_year: 1965,
    person1_retirement_age: 67,
    person1_ss_claiming_age: 67,
    person1_longevity_age: 92,
    person1_ss_benefit_62: 2100,
    person1_ss_benefit_67: 3150,
    has_spouse: true,
    person2_name: 'Sarah Johnson',
    person2_first_name: 'Sarah',
    person2_last_name: 'Johnson',
    person2_birth_year: 1968,
    person2_retirement_age: 67,
    person2_ss_claiming_age: 67,
    person2_longevity_age: 90,
    person2_ss_benefit_62: 1800,
    person2_ss_benefit_67: 2650,
    filing_status: 'mfj',
    state_primary: 'FL',
    state_compare: null,
    inflation_rate: 2.5,
    risk_tolerance: 'moderate',
    target_stocks_pct: 55,
    target_bonds_pct: 35,
    target_cash_pct: 10,
    growth_rate_accumulation: 7,
    growth_rate_retirement: 5,
    estate_complexity_score: 72,
    estate_complexity_flag: 'high',
    deduction_mode: 'standard',
    custom_deduction_amount: 0,
    updated_at: new Date().toISOString(),
  }

  const { data: hhExisting } = await admin.from('households').select('id').eq('owner_id', clientId).maybeSingle()

  let householdId: string

  if (hhExisting?.id) {
    householdId = hhExisting.id
    const { error: hErr } = await admin.from('households').update(householdRow).eq('id', householdId)
    if (hErr) {
      console.error('household update failed:', hErr.message)
      process.exit(1)
    }
    console.log('Updated household', householdId)
  } else {
    const { data: inserted, error: hErr } = await admin
      .from('households')
      .insert(householdRow)
      .select('id')
      .single()
    if (hErr || !inserted?.id) {
      console.error('household insert failed:', hErr?.message)
      process.exit(1)
    }
    householdId = inserted.id
    console.log('Inserted household', householdId)
  }

  await admin.from('assets').delete().eq('owner_id', clientId)
  await admin.from('real_estate').delete().eq('owner_id', clientId)

  const assetInserts = [
    {
      owner_id: clientId,
      owner: 'person1',
      type: 'traditional_401k',
      asset_type: 'traditional_401k',
      name: 'Fidelity 401(k) — Michael',
      value: 920_000,
      account_type: '401k',
      institution: 'Fidelity',
      is_taxable: false,
    },
    {
      owner_id: clientId,
      owner: 'person2',
      type: 'traditional_ira',
      asset_type: 'traditional_ira',
      name: 'Vanguard Traditional IRA — Sarah',
      value: 340_000,
      account_type: 'ira',
      institution: 'Vanguard',
      is_taxable: false,
    },
    {
      owner_id: clientId,
      owner: 'person1',
      type: 'roth_ira',
      asset_type: 'roth_ira',
      name: 'Roth IRA — Michael',
      value: 185_000,
      account_type: 'roth_ira',
      institution: 'Charles Schwab',
      is_taxable: false,
    },
    {
      owner_id: clientId,
      owner: 'joint',
      type: 'taxable_brokerage',
      asset_type: 'taxable_brokerage',
      name: 'Joint brokerage',
      value: 410_000,
      account_type: 'brokerage',
      institution: 'Morgan Stanley',
      is_taxable: true,
    },
    {
      owner_id: clientId,
      owner: 'joint',
      type: 'taxable_brokerage',
      asset_type: 'taxable_brokerage',
      name: 'Cash & equivalents',
      value: 95_000,
      account_type: 'savings',
      institution: 'Ally Bank',
      is_taxable: true,
    },
  ]

  const { error: aErr } = await admin.from('assets').insert(assetInserts)
  if (aErr) console.warn('assets insert (check asset columns migration):', aErr.message)

  const { error: reErr } = await admin.from('real_estate').insert({
    owner_id: clientId,
    owner: 'joint',
    name: 'Primary residence — Naples',
    property_type: 'primary_residence',
    current_value: 1_250_000,
    purchase_price: 980_000,
    purchase_year: 2015,
    mortgage_balance: 310_000,
    monthly_payment: 4200,
    interest_rate: 3.25,
    is_primary_residence: true,
    years_lived_in: 10,
    situs_state: 'FL',
  })
  if (reErr) console.warn('real_estate insert:', reErr.message)

  await admin.from('beneficiaries').delete().eq('owner_id', clientId)
  const { error: benErr } = await admin.from('beneficiaries').insert([
    {
      owner_id: clientId,
      name: 'Emma Johnson',
      relationship: 'Child',
      allocation_pct: 50,
      account_type: '401k',
      contingent: false,
    },
    {
      owner_id: clientId,
      name: 'James Johnson',
      relationship: 'Child',
      allocation_pct: 50,
      account_type: '401k',
      contingent: false,
    },
    {
      owner_id: clientId,
      name: 'Charity — United Way',
      relationship: 'Charity',
      allocation_pct: 10,
      account_type: 'ira',
      contingent: true,
    },
  ])
  if (benErr) console.warn('beneficiaries insert:', benErr.message)

  await admin.from('estate_documents').delete().eq('owner_id', clientId)
  const now = new Date().toISOString()
  const { error: edErr } = await admin.from('estate_documents').insert([
    { owner_id: clientId, document_type: 'will', exists: true, confirmed_at: now },
    { owner_id: clientId, document_type: 'trust', exists: true, confirmed_at: now },
    { owner_id: clientId, document_type: 'dpoa', exists: true, confirmed_at: now },
    { owner_id: clientId, document_type: 'medical_poa', exists: true, confirmed_at: now },
    { owner_id: clientId, document_type: 'advance_directive', exists: false, confirmed_at: null },
    { owner_id: clientId, document_type: 'living_will', exists: false, confirmed_at: null },
  ])
  if (edErr) console.warn('estate_documents insert:', edErr.message)

  await admin.from('advisor_notes').delete().eq('advisor_id', advisorId).eq('client_id', clientId)
  await admin.from('advisor_notes').insert({
    advisor_id: advisorId,
    client_id: clientId,
    content:
      'Demo note: Review Roth conversion ladder before RMD age. Client prefers email summaries; follow up on FL homestead titling in Q3.',
  })

  await admin.from('domicile_analysis').delete().eq('user_id', clientId)
  const { data: domInsert, error: domErr } = await admin
    .from('domicile_analysis')
    .insert({
      user_id: clientId,
      household_id: householdId,
      claimed_domicile_state: 'FL',
      states: [
        { state: 'FL', days_per_year: 200 },
        { state: 'NY', days_per_year: 80 },
        { state: 'MA', days_per_year: 45 },
      ],
      drivers_license_state: 'FL',
      voter_registration_state: 'FL',
      vehicle_registration_state: 'FL',
      primary_home_titled_state: 'FL',
      spouse_children_state: 'FL',
      estate_docs_declare_state: 'FL',
      files_taxes_in_state: 'FL',
      business_interests_state: 'FL',
    })
    .select('id')
    .single()

  if (domErr) {
    console.warn('domicile_analysis insert:', domErr.message)
  } else if (domInsert?.id) {
    const { error: rpcErr } = await admin.rpc('calculate_domicile_risk', { analysis_id: domInsert.id })
    if (rpcErr) console.warn('calculate_domicile_risk:', rpcErr.message)
  }

  await admin.from('advisor_clients').delete().eq('advisor_id', advisorId).eq('client_id', clientId)

  const { error: linkErr } = await admin.from('advisor_clients').insert({
    advisor_id: advisorId,
    client_id: clientId,
    invited_email: clientEmail,
    status: 'active',
    client_status: 'active',
    invited_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
  })

  if (linkErr) {
    console.error('advisor_clients insert failed:', linkErr.message)
    process.exit(1)
  }

  console.log('\nDone.')
  console.log('  Advisor:', advisorEmail, `(${advisorId})`)
  console.log('  Client:', clientEmail, `(${clientId})`)
  console.log('  Open:', `/advisor/clients/${clientId}`)
  if (isNewUser) {
    console.log('  Password (new user only):', demoPassword)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
