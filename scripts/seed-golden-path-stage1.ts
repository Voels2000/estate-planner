/**
 * Seed a Stage 1 golden-path consumer for Playwright smoke tests.
 *
 * Profile: wizard complete, tier 1, exactly 1 financial section (assets only) → plan stage 1.
 *
 * Usage:
 *   dotenv -e .env.local -e .env.test -- npx tsx scripts/seed-golden-path-stage1.ts
 */

import { E2E_IDENTITIES, E2E_TEST_PASSWORD } from './e2e-test-identities'
import {
  ensureAuthUser,
  initSupabaseEnv,
  seedE2eEstateHealthForHousehold,
} from './seed-e2e-lib'
import { createAdminClient } from '../lib/supabase/admin'

const ID = E2E_IDENTITIES.goldenPathStage1

const HOUSEHOLD_ROW = {
  person1_name: 'Golden Path',
  person1_first_name: 'Golden',
  person1_last_name: 'Path',
  person1_birth_year: 1975,
  person1_retirement_age: 67,
  has_spouse: false,
  filing_status: 'single',
  state_primary: 'WA',
  inflation_rate: 2.5,
  risk_tolerance: 'moderate',
  target_stocks_pct: 60,
  target_bonds_pct: 30,
  target_cash_pct: 10,
}

export async function seedGoldenPathStage1(): Promise<{ userId: string; householdId: string }> {
  initSupabaseEnv()
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const userId = await ensureAuthUser({
    email: ID.email,
    password: ID.password,
    fullName: ID.fullName,
    role: 'consumer',
  })

  await admin
    .from('profiles')
    .update({
      full_name: ID.fullName,
      consumer_tier: 1,
      subscription_status: 'active',
      role: 'consumer',
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      onboarding_wizard_completed_at: now,
      onboarding_invite_advisor_completed_at: now,
      onboarding_persona: null,
      updated_at: now,
    })
    .eq('id', userId)

  const householdPayload = {
    owner_id: userId,
    name: ID.householdName,
    ...HOUSEHOLD_ROW,
    updated_at: now,
  }

  const { data: existing } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  let householdId: string
  if (existing?.id) {
    householdId = existing.id
    await admin.from('households').update(householdPayload).eq('id', householdId)
  } else {
    const { data: inserted, error } = await admin
      .from('households')
      .insert(householdPayload)
      .select('id')
      .single()
    if (error || !inserted?.id) throw new Error(`household insert: ${error?.message}`)
    householdId = inserted.id
  }

  await Promise.all([
    admin.from('assets').delete().eq('owner_id', userId),
    admin.from('income').delete().eq('owner_id', userId),
    admin.from('expenses').delete().eq('owner_id', userId),
    admin.from('liabilities').delete().eq('owner_id', userId),
    admin.from('insurance_policies').delete().eq('user_id', userId),
  ])

  const { error: assetErr } = await admin.from('assets').insert({
    owner_id: userId,
    owner: 'person1',
    type: 'financial_account',
    name: 'Golden Path — Brokerage',
    value: 250_000,
  })
  if (assetErr) throw new Error(`asset insert: ${assetErr.message}`)

  await seedE2eEstateHealthForHousehold(householdId)

  return { userId, householdId }
}

async function main() {
  const { userId, householdId } = await seedGoldenPathStage1()
  console.log('Golden path Stage 1 seed complete')
  console.log(`  email: ${ID.email}`)
  console.log(`  password: ${E2E_TEST_PASSWORD}`)
  console.log(`  userId: ${userId}`)
  console.log(`  householdId: ${householdId}`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
