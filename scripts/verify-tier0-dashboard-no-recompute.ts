#!/usr/bin/env npx tsx
/**
 * PR 3 gate 1: canceled persona /dashboard must NOT enqueue recompute even when
 * the heavy path would (stale projection + completed dashboard).
 *
 * Usage:
 *   npm run verify:tier0-no-recompute
 *
 * Requires PR 3 on target (Tier 0 slice UI). Arms staleness before snapshot.
 */
import { chromium } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  armGate1CanceledPersonaFixture,
  GATE1_DEBOUNCE_WAIT_MS,
} from '@/lib/dashboard/armGate1VerifyFixture'
import { E2E_IDENTITIES, E2E_TEST_PASSWORD } from './e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from './seed-e2e-lib'
import { getTestEnvConfig } from './testEnv'

async function main() {
  initSupabaseEnv()
  const { baseURL } = getTestEnvConfig()
  const admin = createAdminClient()
  const email = E2E_IDENTITIES.consumerCanceled.email

  const userId = await findUserIdByEmail(email)
  if (!userId) {
    console.error(`Missing seed user ${email}. Run: npm run seed:e2e`)
    process.exit(1)
  }

  const { data: household } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (!household?.id) {
    console.error(`No household for ${email}. Run: npm run seed:e2e`)
    process.exit(1)
  }

  const householdId = household.id

  const armed = await armGate1CanceledPersonaFixture(admin, userId, householdId)
  console.log('Armed fixture:', armed)

  if (!armed.reachesCompletedDashboard) {
    console.error('FAIL: Fixture would still hit onboarding onramp, not DashboardBody.')
    process.exit(1)
  }

  if (!armed.heavyPathWouldTrigger) {
    console.error(
      'FAIL: Fixture is not stale — heavy path would NOT trigger; test would false-pass.',
    )
    process.exit(1)
  }

  console.log(
    `Precondition OK: heavy path would trigger (${armed.staleReason}); Tier 0 must suppress.`,
  )

  const [{ data: scoreBefore }, { data: cacheBefore }] = await Promise.all([
    admin
      .from('estate_health_scores')
      .select('computed_at, updated_at')
      .eq('household_id', householdId)
      .maybeSingle(),
    admin
      .from('estate_composition_cache')
      .select('computed_at')
      .eq('household_id', householdId)
      .eq('source_role', 'consumer')
      .maybeSingle(),
  ])

  console.log(`Target: ${baseURL}/dashboard as ${email}`)
  console.log(`Household: ${householdId}`)
  console.log('Snapshot BEFORE load:', {
    health_computed_at: scoreBefore?.computed_at ?? null,
    health_updated_at: scoreBefore?.updated_at ?? null,
    cache_computed_at: cacheBefore?.computed_at ?? null,
  })

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${baseURL}/login`)
  await page.locator('input[id="email"]').fill(email)
  await page.locator('input[id="password"]').fill(E2E_TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })

  const res = await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' })
  if (!res || res.status() >= 400) {
    console.error(`Dashboard returned ${res?.status()}`)
    await browser.close()
    process.exit(1)
  }

  await page.getByRole('heading', { name: /welcome back/i }).waitFor({ timeout: 60_000 })

  const bodyText = await page.locator('body').innerText()
  const tier0Slice = /welcome back|your data — always free to enter/i.test(bodyText)
  console.log(`Tier 0 slice UI detected: ${tier0Slice}`)

  if (!tier0Slice) {
    console.error(
      'FAIL: PR 3 Tier 0 slice not deployed — cannot verify compute-safe path on this target.',
    )
    await browser.close()
    process.exit(1)
  }

  console.log(`Waiting ${GATE1_DEBOUNCE_WAIT_MS}ms for debounced recompute window…`)
  await page.waitForTimeout(GATE1_DEBOUNCE_WAIT_MS)

  const [{ data: scoreAfter }, { data: cacheAfter }] = await Promise.all([
    admin
      .from('estate_health_scores')
      .select('computed_at, updated_at')
      .eq('household_id', householdId)
      .maybeSingle(),
    admin
      .from('estate_composition_cache')
      .select('computed_at')
      .eq('household_id', householdId)
      .eq('source_role', 'consumer')
      .maybeSingle(),
  ])

  console.log('Snapshot AFTER debounce:', {
    health_computed_at: scoreAfter?.computed_at ?? null,
    health_updated_at: scoreAfter?.updated_at ?? null,
    cache_computed_at: cacheAfter?.computed_at ?? null,
  })

  await browser.close()

  const healthChanged =
    (scoreBefore?.computed_at ?? null) !== (scoreAfter?.computed_at ?? null) ||
    (scoreBefore?.updated_at ?? null) !== (scoreAfter?.updated_at ?? null)
  const cacheChanged = (cacheBefore?.computed_at ?? null) !== (cacheAfter?.computed_at ?? null)

  if (healthChanged || cacheChanged) {
    console.error('FAIL: Recompute artifacts changed after Tier 0 dashboard load.')
    console.error({ healthChanged, cacheChanged })
    process.exit(1)
  }

  console.log(
    'PASS: Stale heavy-path preconditions armed; Tier 0 dashboard loaded; no recompute artifacts changed.',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
