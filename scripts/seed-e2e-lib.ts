import { createAdminClient } from '../lib/supabase/admin'
import {
  E2E_DEFAULT_BASE_URL,
  E2E_IDENTITIES,
  E2E_REFERRAL_CODES,
  E2E_TEST_PASSWORD,
} from './e2e-test-identities'

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
  tier: 1 | 3,
): Promise<string> {
  const admin = createAdminClient()
  const id = E2E_IDENTITIES.consumer

  const now = new Date().toISOString()
  await admin
    .from('profiles')
    .update({
      full_name: id.fullName,
      consumer_tier: tier,
      subscription_status: 'active',
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
  const { error: assetErr } = await admin.from('assets').insert([
    {
      owner_id: userId,
      owner: 'person1',
      type: 'financial_account',
      name: 'E2E Brokerage — Alex',
      value: 850_000,
    },
    {
      owner_id: userId,
      owner: 'person1',
      type: 'financial_account',
      name: 'E2E Traditional IRA',
      value: 420_000,
    },
  ])
  if (assetErr) console.warn('  assets:', assetErr.message)
  else console.log('  assets: seeded 2 rows')

  await seedE2eEstateHealthForHousehold(householdId)

  return householdId
}

function getSeedAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.PLAYWRIGHT_BASE_URL ??
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

/** Floor estate_health_scores so dashboard onramp gate (≥60) does not catch E2E users. */
export async function ensureMinEstateHealthScore(
  householdId: string,
  minScore: number,
): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: row } = await admin
    .from('estate_health_scores')
    .select('score')
    .eq('household_id', householdId)
    .maybeSingle()

  const current = row?.score ?? 0
  if (current >= minScore) {
    console.log(`  estate_health_scores: ${current} (≥ ${minScore}, ok)`)
    return
  }

  const { error } = await admin.from('estate_health_scores').upsert(
    {
      household_id: householdId,
      score: minScore,
      computed_at: now,
      updated_at: now,
    },
    { onConflict: 'household_id' },
  )
  if (error) console.warn('  estate_health_scores floor:', error.message)
  else console.log(`  estate_health_scores: raised ${current} → ${minScore} (onramp gate)`)
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

/** Drop advisor→consumer links so cross-household IDOR tests stay valid (seed only links advisor client). */
export async function pruneStrayE2eAdvisorClientLinks(
  advisorId: string,
  keepClientUserId: string,
): Promise<void> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('advisor_clients')
    .delete()
    .eq('advisor_id', advisorId)
    .neq('client_id', keepClientUserId)
    .select('id, client_id')

  if (error) {
    console.warn('  advisor_clients prune:', error.message)
    return
  }
  if (data?.length) {
    console.log(`  advisor_clients: removed ${data.length} stray link(s)`)
  }
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
  const { error: assetErr } = await admin.from('assets').insert([
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
  if (assetErr) console.warn('  advisor client assets:', assetErr.message)
  else console.log('  advisor client assets: seeded 5 rows')

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

  await admin.from('beneficiaries').delete().eq('owner_id', clientUserId)
  await admin.from('beneficiaries').insert([
    {
      owner_id: clientUserId,
      name: 'Alex Demo',
      relationship: 'Child',
      allocation_pct: 50,
      account_type: '401k',
      contingent: false,
    },
    {
      owner_id: clientUserId,
      name: 'Sam Demo',
      relationship: 'Child',
      allocation_pct: 50,
      account_type: '401k',
      contingent: false,
    },
  ])

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

  return householdId
}

/** Ensure E2E advisor is a firm owner (required for /billing firm + firm-checkout E2E). */
export async function ensureAdvisorFirmForE2e(
  advisorUserId: string,
  firmName: string,
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
        subscription_status: null,
      })
      .select('id')
      .single()
    if (error || !firm?.id) {
      throw new Error(`firms insert: ${error?.message ?? 'no id'}`)
    }
    firmId = firm.id
    console.log(`  firms: created ${firmId}`)
  } else {
    console.log(`  firms: existing ${firmId}`)
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
    if (account.role === 'attorney' && account.attorney_tier === null) {
      issues.push(`${account.email}: attorney_tier is null`)
    }
    if (account.role === 'consumer' && account.consumer_tier === null) {
      issues.push(`${account.email}: consumer_tier is null`)
    }
    if (account.role === 'advisor' && account.subscription_status === null) {
      issues.push(`${account.email}: subscription_status is null`)
    }
  }

  if (issues.length > 0) {
    console.error('E2E seed validation failed:')
    issues.forEach((i) => console.error(' -', i))
    process.exit(1)
  }

  console.log(`✓ All ${accounts?.length ?? 0} E2E accounts verified`)
}
