import { createAdminClient } from '../lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'
import { fulfillPlanAndExportPurchase } from '../lib/billing/oneTimePurchases'
import {
  E2E_DEFAULT_BASE_URL,
  E2E_IDENTITIES,
  E2E_REFERRAL_CODES,
  E2E_TEST_PASSWORD,
  DRIP_SMOKE_EMAIL,
} from './e2e-test-identities'
import {
  E2E_PERSONA_MATRIX,
  e2eAppTrialEndsAtIso,
  verifyE2ePersonaMatrixIssues,
} from './e2e-persona-matrix'

export function initSupabaseEnv() {
  if (process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL
  }
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (profile?.id) return profile.id

  const { data: authData, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return null
  const match = authData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  return match?.id ?? null
}

export async function fetchHouseholdIdByOwnerId(ownerId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data?.id ?? null
}

export async function ensureAuthUser(opts: {
  email: string
  password: string
  fullName: string
  role: 'consumer' | 'advisor' | 'attorney'
}): Promise<string> {
  const admin = createAdminClient()
  const existingId = await findUserIdByEmail(opts.email)

  if (existingId) {
    await admin.auth.admin.updateUserById(existingId, { password: opts.password })
    await admin
      .from('profiles')
      .update({
        full_name: opts.fullName,
        role: opts.role,
        email: opts.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingId)
    console.log(`  auth: existing user ${opts.email} (password reset)`)
    return existingId
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: { full_name: opts.fullName, role: opts.role },
  })

  if (error || !created.user) {
    const recovered = await findUserIdByEmail(opts.email)
    if (recovered) {
      await admin.auth.admin.updateUserById(recovered, { password: opts.password })
      console.log(`  auth: recovered ${opts.email} after create conflict`)
      return recovered
    }
    throw new Error(`createUser ${opts.email}: ${error?.message ?? 'no user'}`)
  }

  console.log(`  auth: created ${opts.email}`)
  return created.user.id
}

const CONSUMER_HOUSEHOLD_ROW = {
  person1_name: 'Alex Chen',
  person1_first_name: 'Alex',
  person1_last_name: 'Chen',
  person1_birth_year: 1970,
  person1_retirement_age: 67,
  person1_ss_claiming_age: 67,
  person1_longevity_age: 90,
  person1_ss_pia: 2800,
  has_spouse: true,
  person2_name: 'Jordan Chen',
  person2_first_name: 'Jordan',
  person2_last_name: 'Chen',
  person2_birth_year: 1972,
  person2_retirement_age: 67,
  person2_ss_claiming_age: 67,
  person2_longevity_age: 90,
  filing_status: 'mfj',
  state_primary: 'WA',
  state_compare: null,
  inflation_rate: 2.5,
  risk_tolerance: 'moderate',
  target_stocks_pct: 55,
  target_bonds_pct: 35,
  target_cash_pct: 10,
  growth_rate_accumulation: 6,
  growth_rate_retirement: 5,
  deduction_mode: 'standard',
  custom_deduction_amount: 0,
}

export async function seedE2eConsumerHousehold(
  userId: string,
  householdName: string,
  tier: 1 | 2 | 3,
  profile?: { fullName: string },
): Promise<string> {
  const admin = createAdminClient()
  const fullName = profile?.fullName ?? E2E_IDENTITIES.consumer.fullName

  const now = new Date().toISOString()
  await admin
    .from('profiles')
    .update({
      full_name: fullName,
      consumer_tier: tier,
      subscription_status: 'active',
      has_ever_subscribed: true,
      trial_ends_at: null,
      subscription_plan: tier === 2 ? 'retirement_monthly' : null,
      is_superuser: false,
      role: 'consumer',
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      onboarding_wizard_completed_at: now,
      onboarding_invite_advisor_completed_at: now,
      updated_at: now,
    })
    .eq('id', userId)

  const householdPayload = {
    owner_id: userId,
    name: householdName,
    ...CONSUMER_HOUSEHOLD_ROW,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  let householdId: string
  if (existing?.id) {
    householdId = existing.id
    const { error } = await admin.from('households').update(householdPayload).eq('id', householdId)
    if (error) throw new Error(`household update: ${error.message}`)
    console.log(`  household: updated ${householdId}`)
  } else {
    const { data: inserted, error } = await admin
      .from('households')
      .insert(householdPayload)
      .select('id')
      .single()
    if (error || !inserted?.id) throw new Error(`household insert: ${error?.message}`)
    householdId = inserted.id
    console.log(`  household: created ${householdId}`)
  }

  await admin.from('assets').delete().eq('owner_id', userId)
  // Base columns only (owner_id, type, name, value) — prod may lack advisor-demo extras.
  const { error: assetErr } = await admin.from('assets').insert([
    {
      owner_id: userId,
      type: 'traditional_401k',
      name: 'E2E Traditional 401(k) — Alex',
      value: 750_000,
    },
    {
      owner_id: userId,
      type: 'traditional_ira',
      name: 'E2E Traditional IRA — Alex',
      value: 420_000,
    },
    {
      owner_id: userId,
      type: 'taxable_brokerage',
      name: 'E2E Joint brokerage',
      value: 200_000,
    },
  ])
  if (assetErr) console.warn('  assets:', assetErr.message)
  else console.log('  assets: seeded 3 rows (RMD-eligible + brokerage)')

  await admin.from('income').delete().eq('owner_id', userId)
  const { error: incomeErr } = await admin.from('income').insert({
    owner_id: userId,
    source: 'salary',
    name: 'E2E Salary',
    amount: 240_000,
    start_year: new Date().getFullYear(),
    inflation_adjust: true,
    ss_person: 'person1',
  })
  if (incomeErr) console.warn('  income:', incomeErr.message)
  else console.log('  income: seeded salary row')

  await admin.from('expenses').delete().eq('owner_id', userId)
  const { error: expenseErr } = await admin.from('expenses').insert({
    owner_id: userId,
    category: 'living',
    amount: 96_000,
    start_year: new Date().getFullYear(),
    inflation_adjust: true,
  })
  if (expenseErr) console.warn('  expenses:', expenseErr.message)
  else console.log('  expenses: seeded living row')

  await seedE2eEstateHealthForHousehold(householdId)

  return householdId
}

function getSeedAppUrl(): string {
  return (
    process.env.SEED_APP_URL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    E2E_DEFAULT_BASE_URL
  ).replace(/\/$/, '')
}

/** Fire recompute so Playwright polls see a fresh computed_at (requires RECOMPUTE_SECRET). */
export async function triggerE2eRecompute(householdId: string): Promise<void> {
  const secret = process.env.RECOMPUTE_SECRET?.trim()
  if (!secret) {
    console.warn('  recompute: skipped (RECOMPUTE_SECRET not in env)')
    return
  }
  const url = `${getSeedAppUrl()}/api/recompute-estate-health`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-recompute-secret': secret },
      body: JSON.stringify({ householdId }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`  recompute: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    } else {
      console.log('  recompute: triggered via API')
    }
  } catch (err) {
    console.warn('  recompute:', err instanceof Error ? err.message : String(err))
  }
}

/** Health check answers + baseline score so dashboard and recompute polls have a row. */
export async function seedE2eEstateHealthForHousehold(householdId: string): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const staleComputedAt = new Date(Date.now() - 3_600_000).toISOString()

  const { error: checkErr } = await admin.from('estate_health_check').upsert(
    {
      household_id: householdId,
      has_will: true,
      has_trust: true,
      has_poa: true,
      has_hcd: true,
      beneficiaries_current: true,
      completed_at: now,
      updated_at: now,
    },
    { onConflict: 'household_id' },
  )
  if (checkErr) console.warn('  estate_health_check:', checkErr.message)
  else console.log('  estate_health_check: complete')

  const { error: scoreErr } = await admin.from('estate_health_scores').upsert(
    {
      household_id: householdId,
      score: 85,
      computed_at: staleComputedAt,
      updated_at: now,
    },
    { onConflict: 'household_id' },
  )
  if (scoreErr) console.warn('  estate_health_scores:', scoreErr.message)
  else console.log('  estate_health_scores: baseline row (stale computed_at)')

  await triggerE2eRecompute(householdId)
}

export async function ensureAdvisorDirectoryListing(): Promise<string> {
  const admin = createAdminClient()
  const listing = E2E_IDENTITIES.advisorListing
  const code = E2E_REFERRAL_CODES.advisor

  const { data: existing } = await admin
    .from('advisor_directory')
    .select('id, referral_code')
    .or(`email.eq.${listing.email},referral_code.eq.${code}`)
    .maybeSingle()

  if (existing?.id) {
    await admin
      .from('advisor_directory')
      .update({
        referral_code: code,
        email: listing.email,
        contact_name: listing.contactName,
        firm_name: listing.firmName,
        is_verified: true,
        is_active: true,
      })
      .eq('id', existing.id)
    console.log(`  advisor_directory: updated ${existing.id} ref=${code}`)
    return code
  }

  const { data, error } = await admin
    .from('advisor_directory')
    .insert({
      contact_name: listing.contactName,
      firm_name: listing.firmName,
      email: listing.email,
      city: 'Seattle',
      state: 'WA',
      bio: 'E2E advisor directory listing. Not for production.',
      credentials: ['CFP'],
      specializations: ['estate-planning'],
      is_verified: true,
      is_active: true,
      referral_code: code,
    })
    .select('id, referral_code')
    .single()

  if (error) throw new Error(`advisor_directory insert: ${error.message}`)
  const finalCode = data.referral_code ?? code
  await admin.from('advisor_directory').update({ referral_code: code }).eq('id', data.id)
  console.log(`  advisor_directory: created ${data.id} ref=${finalCode}`)
  return code
}

export async function ensureAttorneyListingAndPortal(): Promise<string> {
  const admin = createAdminClient()
  const listingEmail = E2E_IDENTITIES.attorneyListing.email
  const code = E2E_REFERRAL_CODES.attorney
  const portal = E2E_IDENTITIES.attorneyPortal

  let listingId: string
  const { data: existingListing } = await admin
    .from('attorney_listings')
    .select('id, referral_code, profile_id')
    .or(`email.eq.${listingEmail},referral_code.eq.${code}`)
    .maybeSingle()

  if (existingListing?.id) {
    listingId = existingListing.id
    await admin
      .from('attorney_listings')
      .update({
        referral_code: code,
        email: listingEmail,
        contact_name: E2E_IDENTITIES.attorneyListing.contactName,
        firm_name: E2E_IDENTITIES.attorneyListing.firmName,
        is_verified: true,
        is_active: true,
      })
      .eq('id', listingId)
    console.log(`  attorney_listings: updated ${listingId}`)
  } else {
    const { data, error } = await admin
      .from('attorney_listings')
      .insert({
        contact_name: E2E_IDENTITIES.attorneyListing.contactName,
        firm_name: E2E_IDENTITIES.attorneyListing.firmName,
        email: listingEmail,
        city: 'Seattle',
        state: 'WA',
        bar_number: 'E2E-001',
        bio: 'E2E attorney listing. Not for production.',
        fee_structure: 'hourly',
        specializations: ['estate-planning'],
        states_licensed: ['WA'],
        serves_remote: true,
        is_verified: true,
        is_active: true,
        referral_code: code,
      })
      .select('id')
      .single()
    if (error) throw new Error(`attorney_listings insert: ${error.message}`)
    listingId = data.id
    console.log(`  attorney_listings: created ${listingId}`)
  }

  const portalUserId = await ensureAuthUser({
    email: portal.email,
    password: portal.password,
    fullName: portal.fullName,
    role: 'attorney',
  })

  // Attorney account — always set attorney_tier explicitly; don't rely on column default
  const { error: tierErr } = await admin
    .from('profiles')
    .update({ attorney_tier: 0, updated_at: new Date().toISOString() })
    .eq('email', portal.email)
  if (tierErr) throw new Error(`profiles attorney_tier: ${tierErr.message}`)
  console.log(`  profiles: attorney_tier=0 for ${portal.email}`)

  await admin
    .from('attorney_listings')
    .update({ profile_id: portalUserId })
    .eq('id', listingId)

  console.log(`  attorney portal linked profile_id=${portalUserId}`)
  return code
}

export async function linkAdvisorToClient(advisorId: string, clientId: string) {
  const admin = createAdminClient()
  const clientEmail =
    (await admin.from('profiles').select('email').eq('id', clientId).maybeSingle()).data?.email ??
    E2E_IDENTITIES.advisorClient.email

  const { data: link } = await admin
    .from('advisor_clients')
    .select('id, status')
    .eq('advisor_id', advisorId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (!link) {
    const { error } = await admin.from('advisor_clients').insert({
      advisor_id: advisorId,
      client_id: clientId,
      invited_email: clientEmail,
      status: 'active',
      client_status: 'active',
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    })
    if (error) throw new Error(`advisor_clients: ${error.message}`)
    console.log('  advisor_clients: linked advisor → advisor client')
  } else if (link.status !== 'active') {
    await admin
      .from('advisor_clients')
      .update({
        status: 'active',
        client_status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', link.id)
    console.log('  advisor_clients: reactivated link')
  } else {
    console.log('  advisor_clients: already active')
  }
}

/** Drop advisor→consumer links outside the keep-list (seed controls cast topology). */
export async function pruneStrayE2eAdvisorClientLinks(
  advisorId: string,
  keepClientUserIds: string | string[],
): Promise<void> {
  const admin = createAdminClient()
  const keepSet = new Set(
    (Array.isArray(keepClientUserIds) ? keepClientUserIds : [keepClientUserIds]).filter(Boolean),
  )
  const { data, error } = await admin
    .from('advisor_clients')
    .select('id, client_id')
    .eq('advisor_id', advisorId)

  if (error) {
    console.warn('  advisor_clients prune:', error.message)
    return
  }

  const toRemove = (data ?? []).filter((row) => !keepSet.has(row.client_id))
  if (!toRemove.length) return

  const { error: delErr } = await admin
    .from('advisor_clients')
    .delete()
    .in(
      'id',
      toRemove.map((r) => r.id),
    )
  if (delErr) console.warn('  advisor_clients prune delete:', delErr.message)
  else console.log(`  advisor_clients: removed ${toRemove.length} stray link(s)`)
}

/** Rich advisor-client household (401k, IRA, domicile, documents) for advisor workspace E2E. */
export async function seedE2eAdvisorClientHousehold(
  clientUserId: string,
  advisorId: string,
): Promise<string> {
  const admin = createAdminClient()
  const client = E2E_IDENTITIES.advisorClient
  const now = new Date().toISOString()

  await admin
    .from('profiles')
    .update({
      full_name: client.fullName,
      subscription_status: 'active',
      consumer_tier: 3,
      is_superuser: false,
      role: 'consumer',
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      onboarding_wizard_completed_at: now,
      onboarding_invite_advisor_completed_at: now,
      updated_at: now,
    })
    .eq('id', clientUserId)

  const householdRow = {
    owner_id: clientUserId,
    name: client.householdName,
    person1_name: 'Morgan Demo',
    person1_first_name: 'Morgan',
    person1_last_name: 'Demo',
    person1_birth_year: 1965,
    person1_retirement_age: 67,
    person1_ss_claiming_age: 67,
    person1_longevity_age: 92,
    person1_ss_benefit_62: 2100,
    person1_ss_benefit_67: 3150,
    has_spouse: true,
    person2_name: 'Riley Demo',
    person2_first_name: 'Riley',
    person2_last_name: 'Demo',
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
    updated_at: now,
  }

  const { data: hhExisting } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', clientUserId)
    .maybeSingle()

  let householdId: string
  if (hhExisting?.id) {
    householdId = hhExisting.id
    const { error } = await admin.from('households').update(householdRow).eq('id', householdId)
    if (error) throw new Error(`advisor client household update: ${error.message}`)
    console.log(`  advisor client household: updated ${householdId}`)
  } else {
    const { data: inserted, error } = await admin
      .from('households')
      .insert(householdRow)
      .select('id')
      .single()
    if (error || !inserted?.id) throw new Error(`advisor client household insert: ${error?.message}`)
    householdId = inserted.id
    console.log(`  advisor client household: created ${householdId}`)
  }

  await admin.from('assets').delete().eq('owner_id', clientUserId)
  const { data: insertedAssets, error: assetErr } = await admin
    .from('assets')
    .insert([
      {
        owner_id: clientUserId,
        owner: 'person1',
        type: 'traditional_401k',
        asset_type: 'traditional_401k',
        name: 'Fidelity 401(k) — Morgan',
        value: 920_000,
        account_type: '401k',
        institution: 'Fidelity',
        is_taxable: false,
      },
      {
        owner_id: clientUserId,
        owner: 'person2',
        type: 'traditional_ira',
        asset_type: 'traditional_ira',
        name: 'Vanguard Traditional IRA — Riley',
        value: 340_000,
        account_type: 'ira',
        institution: 'Vanguard',
        is_taxable: false,
      },
      {
        owner_id: clientUserId,
        owner: 'person1',
        type: 'roth_ira',
        asset_type: 'roth_ira',
        name: 'Roth IRA — Morgan',
        value: 185_000,
        account_type: 'roth_ira',
        institution: 'Charles Schwab',
        is_taxable: false,
      },
      {
        owner_id: clientUserId,
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
        owner_id: clientUserId,
        owner: 'joint',
        type: 'taxable_brokerage',
        asset_type: 'taxable_brokerage',
        name: 'Cash & equivalents',
        value: 95_000,
        account_type: 'savings',
        institution: 'Ally Bank',
        is_taxable: true,
      },
    ])
    .select('id, name, account_type')
  if (assetErr) throw new Error(`advisor client assets: ${assetErr.message}`)
  console.log(`  advisor client assets: seeded ${insertedAssets?.length ?? 0} rows`)

  const fourOhOneK = insertedAssets?.find(
    (a) => a.account_type === '401k' || a.name?.includes('401'),
  )
  if (!fourOhOneK?.id) {
    throw new Error('advisor client assets: 401(k) row missing after insert — cannot seed beneficiaries')
  }

  await admin.from('real_estate').delete().eq('owner_id', clientUserId)
  const { error: reErr } = await admin.from('real_estate').insert({
    owner_id: clientUserId,
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
  if (reErr) console.warn('  advisor client real_estate:', reErr.message)

  await admin.from('asset_beneficiaries').delete().eq('owner_id', clientUserId)
  const { data: beneRows, error: beneErr } = await admin
    .from('asset_beneficiaries')
    .insert([
      {
        owner_id: clientUserId,
        asset_id: fourOhOneK.id,
        full_name: 'Alex Demo',
        relationship: 'Child',
        allocation_pct: 50,
        beneficiary_type: 'primary',
      },
      {
        owner_id: clientUserId,
        asset_id: fourOhOneK.id,
        full_name: 'Sam Demo',
        relationship: 'Child',
        allocation_pct: 50,
        beneficiary_type: 'primary',
      },
      {
        owner_id: clientUserId,
        asset_id: fourOhOneK.id,
        full_name: 'Jordan Demo',
        relationship: 'Sibling',
        allocation_pct: 100,
        beneficiary_type: 'contingent',
      },
    ])
    .select('id')
  if (beneErr) throw new Error(`advisor client asset_beneficiaries: ${beneErr.message}`)
  if (!beneRows?.length || beneRows.length < 3) {
    throw new Error(
      `advisor client asset_beneficiaries: expected 3 rows, got ${beneRows?.length ?? 0}`,
    )
  }
  console.log(`  advisor client asset_beneficiaries: seeded ${beneRows.length} rows on 401(k)`)

  await admin.from('estate_documents').delete().eq('owner_id', clientUserId)
  await admin.from('estate_documents').insert([
    { owner_id: clientUserId, document_type: 'will', exists: true, confirmed_at: now },
    { owner_id: clientUserId, document_type: 'trust', exists: true, confirmed_at: now },
    { owner_id: clientUserId, document_type: 'dpoa', exists: true, confirmed_at: now },
    { owner_id: clientUserId, document_type: 'medical_poa', exists: true, confirmed_at: now },
  ])

  await admin.from('advisor_notes').delete().eq('advisor_id', advisorId).eq('client_id', clientUserId)
  await admin.from('advisor_notes').insert({
    advisor_id: advisorId,
    client_id: clientUserId,
    content: 'E2E note: Review Roth conversion ladder before RMD age.',
  })

  await admin.from('domicile_analysis').delete().eq('user_id', clientUserId)
  const { data: domInsert } = await admin
    .from('domicile_analysis')
    .insert({
      user_id: clientUserId,
      household_id: householdId,
      claimed_domicile_state: 'FL',
      states: [
        { state: 'FL', days_per_year: 200 },
        { state: 'NY', days_per_year: 80 },
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
  if (domInsert?.id) {
    await admin.rpc('calculate_domicile_risk', { analysis_id: domInsert.id })
  }

  await seedE2eEstateHealthForHousehold(householdId)
  await linkAdvisorToClient(advisorId, clientUserId)
  await pruneStrayE2eAdvisorClientLinks(advisorId, clientUserId)
  await triggerE2eGenerateBaseCase(householdId, E2E_IDENTITIES.advisor.email, 'advisor')

  return householdId
}

/** Ensure E2E advisor is a firm owner (required for /billing firm + firm-checkout E2E). */
export async function ensureAdvisorFirmForE2e(
  advisorUserId: string,
  firmName: string,
): Promise<string> {
  return ensureAdvisorFirmBootstrap(advisorUserId, firmName, 'active')
}

/**
 * Firm owner bootstrap — transcribed writes used by staging E2E and prod canary setup.
 * `trialing` clears getAdvisorClientCapacity without paid Stripe; `active` for staging E2E.
 */
export async function ensureAdvisorFirmBootstrap(
  advisorUserId: string,
  firmName: string,
  subscriptionStatus: 'active' | 'trialing',
): Promise<string> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('firm_id, firm_role')
    .eq('id', advisorUserId)
    .single()

  let firmId = profile?.firm_id ?? null

  if (!firmId) {
    const { data: existingFirm } = await admin
      .from('firms')
      .select('id')
      .eq('owner_id', advisorUserId)
      .maybeSingle()
    firmId = existingFirm?.id ?? null
  }

  if (!firmId) {
    const { data: firm, error } = await admin
      .from('firms')
      .insert({
        name: firmName,
        owner_id: advisorUserId,
        tier: 'starter',
        seat_count: 1,
        subscription_status: subscriptionStatus,
      })
      .select('id')
      .single()
    if (error || !firm?.id) {
      throw new Error(`firms insert: ${error?.message ?? 'no id'}`)
    }
    firmId = firm.id
    console.log(`  firms: created ${firmId} (${subscriptionStatus})`)
  } else {
    console.log(`  firms: existing ${firmId}`)
    const { error: firmErr } = await admin
      .from('firms')
      .update({
        subscription_status: subscriptionStatus,
        owner_id: advisorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', firmId)
    if (firmErr) console.warn('  firms subscription_status:', firmErr.message)
  }

  await admin
    .from('profiles')
    .update({
      firm_id: firmId,
      firm_role: 'owner',
      firm_name: firmName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', advisorUserId)

  const { data: ownerMember } = await admin
    .from('firm_members')
    .select('id')
    .eq('firm_id', firmId)
    .eq('user_id', advisorUserId)
    .eq('firm_role', 'owner')
    .maybeSingle()

  if (!ownerMember) {
    const { error: memberError } = await admin.from('firm_members').insert({
      firm_id: firmId,
      user_id: advisorUserId,
      firm_role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })
    if (memberError) throw new Error(`firm_members owner insert: ${memberError.message}`)
    console.log('  firm_members: owner row created')
  }

  return firmId
}

/** E2E advisors need active firm billing so invite/accept and /prospect paths pass the gate. */
export async function ensureE2eAdvisorFirmSubscriptionActive(advisorUserId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('firm_id')
    .eq('id', advisorUserId)
    .maybeSingle()
  if (!profile?.firm_id) return

  await admin
    .from('firms')
    .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
    .eq('id', profile.firm_id)
}

function supabaseProjectRef(url: string): string {
  return new URL(url).hostname.split('.')[0] ?? 'local'
}

/** Cookie header for Next.js API routes from a Supabase session (E2E API calls). */
export function buildSupabaseAuthCookieHeader(
  supabaseUrl: string,
  session: {
    access_token: string
    refresh_token: string
    expires_at?: number
    expires_in?: number
    token_type: string
    user: unknown
  },
): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64')
  return `sb-${supabaseProjectRef(supabaseUrl)}-auth-token=base64-${payload}`
}

function authCookieHeader(
  supabaseUrl: string,
  session: {
    access_token: string
    refresh_token: string
    expires_at?: number
    expires_in?: number
    token_type: string
    user: unknown
  },
): string {
  return buildSupabaseAuthCookieHeader(supabaseUrl, session)
}

/** Magic-link session for seed-time API calls (generate-base-case). */
export async function createE2eAuthSessionForEmail(email: string) {
  const admin = createAdminClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for seed API calls')
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`generateLink ${email}: ${linkErr?.message ?? 'no token'}`)
  }

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })
  if (error || !data.session) {
    throw new Error(`verifyOtp ${email}: ${error?.message ?? 'no session'}`)
  }
  return { session: data.session, supabaseUrl }
}

/** POST generate-base-case against deployed app (consumer or advisor route). */
export async function triggerE2eGenerateBaseCase(
  householdId: string,
  sessionEmail: string,
  mode: 'consumer' | 'advisor',
): Promise<void> {
  const baseUrl = getSeedAppUrl()
  const path =
    mode === 'consumer' ? '/api/consumer/generate-base-case' : '/api/advisor/generate-base-case'

  try {
    const { session, supabaseUrl } = await createE2eAuthSessionForEmail(sessionEmail)
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieHeader(supabaseUrl, session),
      },
      body: JSON.stringify({ householdId }),
      signal: AbortSignal.timeout(120_000),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.warn(
        `  generate-base-case (${mode}): HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`,
      )
      return
    }
    console.log(`  generate-base-case (${mode}): ok scenario=${(body as { scenarioId?: string }).scenarioId ?? '—'}`)
  } catch (err) {
    console.warn(
      `  generate-base-case (${mode}):`,
      err instanceof Error ? err.message : String(err),
    )
  }
}

/** Floor tier-1 household score for needs-attention advisor roster tests. */
export async function seedE2eLowScoreHousehold(householdId: string, score = 40): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from('estate_health_scores').upsert(
    {
      household_id: householdId,
      score,
      computed_at: now,
      updated_at: now,
    },
    { onConflict: 'household_id' },
  )
  if (error) console.warn('  estate_health_scores low-score:', error.message)
  else console.log(`  estate_health_scores: set ${score} (needs-attention path)`)
}

/** Pending advisor recommendation on consumer household (mobile step 18). */
export async function seedE2ePendingAdvisorRecommendation(
  advisorId: string,
  consumerHouseholdId: string,
): Promise<void> {
  const admin = createAdminClient()
  const scenarioName = 'E2E Seed Pending Recommendation'

  const { data: existing } = await admin
    .from('strategy_line_items')
    .select('id')
    .eq('household_id', consumerHouseholdId)
    .eq('strategy_source', 'slat')
    .eq('source_role', 'advisor')
    .eq('scenario_name', scenarioName)
    .maybeSingle()

  const row = {
    household_id: consumerHouseholdId,
    scenario_id: 'current_law',
    projection_year: null,
    metric_target: 'taxable_estate' as const,
    category: 'trust_exclusion' as const,
    strategy_source: 'slat',
    source_role: 'advisor' as const,
    advisor_id: advisorId,
    amount: 250_000,
    sign: -1,
    confidence_level: 'probable' as const,
    effective_year: new Date().getFullYear(),
    scenario_name: scenarioName,
    is_active: true,
    consumer_accepted: false,
    consumer_rejected: false,
    metadata: { e2e_seed: true },
  }

  if (existing?.id) {
    const { error } = await admin.from('strategy_line_items').update(row).eq('id', existing.id)
    if (error) console.warn('  strategy_line_items pending rec update:', error.message)
    else console.log('  strategy_line_items: pending advisor recommendation (updated)')
    return
  }

  const { error } = await admin.from('strategy_line_items').insert(row)
  if (error) console.warn('  strategy_line_items pending rec:', error.message)
  else console.log('  strategy_line_items: pending advisor recommendation')
}

/** email_captures row for drip step-1 verify (no inbox). */
export async function seedE2eDripCapture(): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: existing } = await admin
    .from('email_captures')
    .select('id')
    .eq('email', DRIP_SMOKE_EMAIL)
    .maybeSingle()

  const row = {
    email: DRIP_SMOKE_EMAIL,
    source: 'e2e-seed',
    score: 42,
    captured_at: now,
    drip_step_1_sent_at: now,
    drip_step_2_sent_at: null,
    drip_step_3_sent_at: null,
    unsubscribed_at: null,
  }

  if (existing?.id) {
    const { error } = await admin.from('email_captures').update(row).eq('id', existing.id)
    if (error) console.warn('  email_captures drip:', error.message)
    else console.log(`  email_captures: updated ${DRIP_SMOKE_EMAIL} (step 1 sent)`)
    return
  }

  const { error } = await admin.from('email_captures').insert(row)
  if (error) console.warn('  email_captures drip:', error.message)
  else console.log(`  email_captures: created ${DRIP_SMOKE_EMAIL} (step 1 sent)`)
}

/** Second advisor with firm — zero linked clients for playbook empty state. */
export async function ensureAdvisorEmptyForE2e(): Promise<string> {
  const admin = createAdminClient()
  const empty = E2E_IDENTITIES.advisorEmpty

  const advisorId = await ensureAuthUser({
    email: empty.email,
    password: empty.password,
    fullName: empty.fullName,
    role: 'advisor',
  })

  await admin
    .from('profiles')
    .update({
      subscription_status: null,
      consumer_tier: null,
      is_superuser: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', advisorId)

  await ensureAdvisorFirmForE2e(advisorId, empty.firmName)

  const { data: profileAfterFirm } = await admin
    .from('profiles')
    .select('firm_id')
    .eq('id', advisorId)
    .single()

  if (profileAfterFirm?.firm_id) {
    await admin
      .from('firms')
      .update({ subscription_status: null, updated_at: new Date().toISOString() })
      .eq('id', profileAfterFirm.firm_id)
  }

  const { error } = await admin.from('advisor_clients').delete().eq('advisor_id', advisorId)
  if (error) console.warn('  advisor-empty links purge:', error.message)
  else console.log('  advisor-empty: zero linked clients')

  return advisorId
}

/** Enrich consumer cast after all users exist: projections, pending rec, base case. */
export async function seedE2eConsumerEnrichments(opts: {
  consumerUserId: string
  consumerHouseholdId: string
  tier1HouseholdId?: string
  primaryAdvisorId?: string
  tier1UserId?: string
  advisorClientUserId?: string
}): Promise<void> {
  if (opts.primaryAdvisorId) {
    await seedE2ePendingAdvisorRecommendation(opts.primaryAdvisorId, opts.consumerHouseholdId)
  }

  await triggerE2eGenerateBaseCase(
    opts.consumerHouseholdId,
    E2E_IDENTITIES.consumer.email,
    'consumer',
  )

  if (opts.tier1HouseholdId) {
    await seedE2eLowScoreHousehold(opts.tier1HouseholdId, 40)
  }

  if (opts.primaryAdvisorId && opts.tier1UserId && opts.advisorClientUserId) {
    await linkAdvisorToClient(opts.primaryAdvisorId, opts.tier1UserId)
    await pruneStrayE2eAdvisorClientLinks(opts.primaryAdvisorId, [
      opts.advisorClientUserId,
      opts.tier1UserId,
    ])
  }

  await seedE2eDripCapture()
}

/** Production Supabase project ref — superuser fixture must never seed here. */
const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'

function extractSupabaseProjectRef(url: string): string | null {
  try {
    const match = new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function isProductionSupabaseTarget(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  return extractSupabaseProjectRef(url) === PRODUCTION_SUPABASE_PROJECT_REF
}

export async function ensureE2eSuperuser(): Promise<string | null> {
  if (isProductionSupabaseTarget()) {
    console.log('  superuser: skipped (production Supabase — staging-only fixture)')
    return null
  }

  const admin = createAdminClient()
  const su = E2E_IDENTITIES.superuser
  const now = new Date().toISOString()

  const userId = await ensureAuthUser({
    email: su.email,
    password: su.password,
    fullName: su.fullName,
    role: 'consumer',
  })

  await admin
    .from('profiles')
    .update({
      full_name: su.fullName,
      role: 'consumer',
      email: su.email,
      is_superuser: true,
      is_admin: false,
      consumer_tier: 1,
      subscription_status: null,
      firm_id: null,
      firm_role: null,
      firm_name: null,
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      updated_at: now,
    })
    .eq('id', userId)

  await admin.from('households').delete().eq('owner_id', userId)
  await admin.from('assets').delete().eq('owner_id', userId)

  console.log(`  superuser: ${su.email} (is_superuser, no household)`)
  return userId
}

/** Former subscriber — canceled, no app-trial re-grant (tier restructure PR 1). */
export async function ensureE2eCanceledSubscriber(): Promise<string> {
  const admin = createAdminClient()
  const id = E2E_IDENTITIES.consumerCanceled
  const now = new Date().toISOString()

  const userId = await ensureAuthUser({
    email: id.email,
    password: id.password,
    fullName: id.fullName,
    role: 'consumer',
  })

  await admin
    .from('profiles')
    .update({
      full_name: id.fullName,
      role: 'consumer',
      email: id.email,
      consumer_tier: 0,
      subscription_status: 'canceled',
      has_ever_subscribed: true,
      trial_ends_at: null,
      subscription_plan: null,
      stripe_subscription_id: null,
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      updated_at: now,
    })
    .eq('id', userId)

  const { data: existing } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (!existing?.id) {
    const { error } = await admin.from('households').insert({
      owner_id: userId,
      name: id.householdName,
      person1_name: id.fullName,
      state_primary: 'WA',
      filing_status: 'single',
      person1_birth_year: 1970,
      updated_at: now,
    })
    if (error) throw new Error(`canceled household insert: ${error.message}`)
  } else {
    await admin
      .from('households')
      .update({
        person1_name: id.fullName,
        state_primary: 'WA',
        filing_status: 'single',
        person1_birth_year: 1970,
        updated_at: now,
      })
      .eq('id', existing.id)
  }

  await admin.from('assets').delete().eq('owner_id', userId)
  await admin.from('income').delete().eq('owner_id', userId)

  const { error: assetErr } = await admin.from('assets').insert({
    owner_id: userId,
    type: 'taxable_brokerage',
    name: 'Canceled persona — brokerage',
    value: 100_000,
  })
  if (assetErr) console.warn('  canceled assets:', assetErr.message)

  const { error: incomeErr } = await admin.from('income').insert({
    owner_id: userId,
    source: 'salary',
    name: 'Canceled persona — salary',
    amount: 80_000,
    start_year: new Date().getFullYear(),
    inflation_adjust: true,
  })
  if (incomeErr) console.warn('  canceled income:', incomeErr.message)

  console.log(`  canceled subscriber: ${id.email} (has_ever_subscribed, tier 0)`)
  return userId
}

/** App-managed trial window — effective tier 3 via resolveEffectiveTier (PR 1 columns). */
export async function ensureE2eAppTrialConsumer(): Promise<string> {
  const admin = createAdminClient()
  const id = E2E_IDENTITIES.consumerAppTrial
  const now = new Date().toISOString()
  const trialEnds = e2eAppTrialEndsAtIso()

  const userId = await ensureAuthUser({
    email: id.email,
    password: id.password,
    fullName: id.fullName,
    role: 'consumer',
  })

  await admin
    .from('profiles')
    .update({
      full_name: id.fullName,
      role: 'consumer',
      email: id.email,
      consumer_tier: 0,
      subscription_status: 'none',
      has_ever_subscribed: false,
      trial_ends_at: trialEnds,
      subscription_plan: null,
      stripe_subscription_id: null,
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      onboarding_wizard_completed_at: now,
      updated_at: now,
    })
    .eq('id', userId)

  const { data: existing } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (!existing?.id) {
    const { error } = await admin.from('households').insert({
      owner_id: userId,
      name: id.householdName,
      state_primary: 'WA',
      filing_status: 'single',
      person1_birth_year: 1985,
      updated_at: now,
    })
    if (error) throw new Error(`app-trial household insert: ${error.message}`)
  }

  console.log(`  app-trial consumer: ${id.email} (trial_ends_at future, has_ever_subscribed false)`)
  return userId
}

/** Completed Plan & Export purchase, no active subscription — deliverable purchaser path. */
export async function ensureE2ePlanExportPurchaser(): Promise<string> {
  const admin = createAdminClient()
  const id = E2E_IDENTITIES.consumerPlanExport
  const now = new Date().toISOString()

  const userId = await ensureAuthUser({
    email: id.email,
    password: id.password,
    fullName: id.fullName,
    role: 'consumer',
  })

  await admin
    .from('profiles')
    .update({
      full_name: id.fullName,
      role: 'consumer',
      email: id.email,
      consumer_tier: 1,
      subscription_status: 'none',
      has_ever_subscribed: false,
      trial_ends_at: null,
      subscription_plan: null,
      stripe_subscription_id: null,
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      onboarding_wizard_completed_at: now,
      updated_at: now,
    })
    .eq('id', userId)

  const { data: existing } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (!existing?.id) {
    const { error } = await admin.from('households').insert({
      owner_id: userId,
      name: id.householdName,
      state_primary: 'WA',
      filing_status: 'single',
      person1_birth_year: 1975,
      updated_at: now,
    })
    if (error) throw new Error(`plan-export household insert: ${error.message}`)
  }

  await admin
    .from('one_time_purchases')
    .delete()
    .eq('user_id', userId)
    .eq('sku', 'plan_and_export')

  const { error: fulfillErr } = await fulfillPlanAndExportPurchase({
    admin,
    userId,
    sessionId: `e2e_seed_plan_export_${userId.slice(0, 8)}`,
    paymentIntentId: null,
    amountCents: 149_000,
    currency: 'usd',
    refundAck: {
      at: now,
      version: '2026-06-26',
    },
  })
  if (fulfillErr) throw new Error(`plan-export purchase seed: ${fulfillErr.message}`)

  console.log(`  plan-export purchaser: ${id.email} (completed one_time_purchases, no active sub)`)
  return userId
}

/** Linked-consumer fixture household — no advisor_clients row; link is created in Playwright setup. */
export async function ensureE2eConsumerLinked(): Promise<{ userId: string; householdId: string }> {
  const admin = createAdminClient()
  const linked = E2E_IDENTITIES.consumerLinked

  const userId = await ensureAuthUser({
    email: linked.email,
    password: linked.password,
    fullName: linked.fullName,
    role: 'consumer',
  })

  const householdId = await seedE2eConsumerHousehold(
    userId,
    linked.householdName,
    3,
    { fullName: linked.fullName },
  )

  await triggerE2eGenerateBaseCase(householdId, linked.email, 'consumer')

  const { error } = await admin.from('advisor_clients').delete().eq('client_id', userId)
  if (error) console.warn('  consumer-linked advisor_clients purge:', error.message)
  else console.log('  consumer-linked: no advisor_clients row (link via Playwright setup)')

  return { userId, householdId }
}

/** Fail loudly if any @mywealthmaps.test account is in an invalid state. */
export async function verifyE2eAccounts(): Promise<void> {
  const admin = createAdminClient()
  const { data: accounts, error } = await admin
    .from('profiles')
    .select('email, role, consumer_tier, attorney_tier, subscription_status')
    .like('email', '%mywealthmaps.test%')

  if (error) throw new Error(`E2E seed validation query: ${error.message}`)

  const issues: string[] = []
  for (const account of accounts ?? []) {
    if (account.email === E2E_IDENTITIES.superuser.email) {
      continue
    }
    if (account.role === 'attorney' && account.attorney_tier === null) {
      issues.push(`${account.email}: attorney_tier is null`)
    }
    if (account.role === 'consumer' && account.consumer_tier === null) {
      issues.push(`${account.email}: consumer_tier is null`)
    }
  }

  const advisorClientId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)
  if (advisorClientId) {
    const { count, error: beneCountErr } = await admin
      .from('asset_beneficiaries')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', advisorClientId)
    if (beneCountErr) {
      issues.push(
        `${E2E_IDENTITIES.advisorClient.email}: asset_beneficiaries count failed — ${beneCountErr.message}`,
      )
    } else if (!count || count < 2) {
      issues.push(
        `${E2E_IDENTITIES.advisorClient.email}: asset_beneficiaries count ${count ?? 0} (expected >= 2)`,
      )
    }
  }

  if (issues.length > 0) {
    console.error('E2E seed validation failed:')
    issues.forEach((i) => console.error(' -', i))
    process.exit(1)
  }

  const personaIssues = await verifyE2ePersonaMatrixIssues(admin)
  if (personaIssues.length > 0) {
    console.error('E2E persona matrix validation failed:')
    personaIssues.forEach((i) => console.error(' -', i))
    process.exit(1)
  }

  console.log(`✓ All ${accounts?.length ?? 0} E2E accounts verified`)
  console.log(`✓ Tier-restructure persona matrix (${E2E_PERSONA_MATRIX.length} branches) satisfied`)
}
