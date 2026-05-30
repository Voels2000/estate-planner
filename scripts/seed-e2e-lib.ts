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
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    if (error) throw new Error(`advisor_clients: ${error.message}`)
    console.log('  advisor_clients: linked advisor → Johnson client')
  } else if (link.status !== 'active') {
    await admin
      .from('advisor_clients')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', link.id)
    console.log('  advisor_clients: reactivated link')
  } else {
    console.log('  advisor_clients: already active')
  }
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

/** Run Michael Johnson demo seed via env (existing script). */
export async function runMichaelJohnsonDemoSeed(advisorEmail: string, clientEmail: string) {
  process.env.SEED_ADVISOR_EMAIL = advisorEmail
  process.env.SEED_CLIENT_EMAIL = clientEmail
  process.env.SEED_DEMO_PASSWORD = E2E_TEST_PASSWORD
  const { execSync } = await import('child_process')
  execSync('npx tsx scripts/seed-michael-johnson-advisor-demo.ts', {
    stdio: 'inherit',
    env: process.env,
  })
}
