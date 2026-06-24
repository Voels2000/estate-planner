#!/usr/bin/env npx tsx
/**
 * PR 3 gate 1 staging check: load canceled-persona /dashboard and confirm
 * estate_health_scores + estate_composition_cache timestamps did not advance
 * (no background recompute enqueued).
 *
 * Usage:
 *   TEST_ENV=staging npx tsx scripts/verify-tier0-dashboard-no-recompute.ts
 *
 * Requires: .env.test.staging (or .env.local) with Supabase service role + Playwright base URL.
 */
import { chromium } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import { E2E_IDENTITIES, E2E_TEST_PASSWORD } from './e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from './seed-e2e-lib'
import { getTestEnvConfig } from './testEnv'

const DEBOUNCE_WAIT_MS = 6_000

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
  console.log('Before:', {
    health_computed_at: scoreBefore?.computed_at ?? null,
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

  const bodyText = await page.locator('body').innerText()
  const tier0Slice = /welcome back|your data — always free to enter/i.test(bodyText)
  console.log(`Tier 0 slice UI detected: ${tier0Slice}`)
  if (!tier0Slice) {
    console.warn(
      'WARN: Full dashboard may still be deployed — PR 3 must be on staging for this check.',
    )
  }

  await page.waitForTimeout(DEBOUNCE_WAIT_MS)

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

  console.log('After:', {
    health_computed_at: scoreAfter?.computed_at ?? null,
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

  console.log('PASS: No recompute artifact timestamps changed after dashboard load.')
  if (!tier0Slice) {
    console.warn('NOTE: Pass on timestamps only — deploy PR 3 and re-run for UI confirmation.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
