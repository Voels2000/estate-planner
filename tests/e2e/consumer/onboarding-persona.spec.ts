/**
 * Persona onboarding — select persona → saved as business_owner; user leaves persona screen.
 * Uses golden-path Stage 1 user (MVI complete, persona cleared for test).
 */
import { test, expect } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { seedGoldenPathStage1 } from '../../../scripts/seed-golden-path-stage1'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'
import { syncE2ePasswordForEmail } from '../helpers/e2e-auth'

const ID = E2E_IDENTITIES.goldenPathStage1

test.describe.configure({ mode: 'serial', timeout: 120_000 })
test.use({ storageState: { cookies: [], origins: [] } })

async function loginGoldenPath(page: import('@playwright/test').Page) {
  await syncE2ePasswordForEmail(ID.email, ID.password)
  await page.goto('/login')
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(ID.email)
  await page.locator('input[id="password"]').fill(ID.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
}

async function clearPersonaForTest() {
  initSupabaseEnv()
  const userId = await findUserIdByEmail(ID.email)
  if (!userId) throw new Error(`Golden path user ${ID.email} not found — run seed:e2e`)
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({
      onboarding_persona: null,
      onboarding_wizard_completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  await admin
    .from('households')
    .update({
      person1_name: 'Golden Path',
      person1_first_name: 'Golden',
      person1_last_name: 'Path',
      state_primary: 'WA',
      filing_status: 'single',
      person1_birth_year: 1975,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', userId)
}

test.beforeAll(async () => {
  await seedGoldenPathStage1()
  await clearPersonaForTest()
})

test('persona selection saves business_owner and leaves persona screen', async ({ page }) => {
  await loginGoldenPath(page)
  await clearPersonaForTest()
  await page.goto('/onboarding/persona')
  await expect(page).toHaveURL(/\/onboarding\/persona/, { timeout: 30_000 })

  await expect(
    page.getByRole('heading', { level: 1, name: 'What describes you?' }),
  ).toBeVisible({ timeout: 30_000 })

  const businessCard = page.locator('[aria-pressed]').filter({ hasText: 'I own a business' })
  await businessCard.click()
  await expect(businessCard).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeEnabled()

  const [saveResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/consumer/profile') && r.request().method() === 'PATCH',
    ),
    page.getByRole('button', { name: 'Continue →' }).click(),
  ])
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy()

  await page.waitForURL((url) => !url.pathname.includes('/onboarding/persona'), {
    timeout: 30_000,
  })

  initSupabaseEnv()
  const userId = await findUserIdByEmail(ID.email)
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('onboarding_persona')
    .eq('id', userId!)
    .single()
  expect(profile?.onboarding_persona).toBe('business_owner')

  if (page.url().includes('/dashboard')) {
    await expect(page.getByText(/Add your business to see succession exposure/i)).toBeVisible({
      timeout: 15_000,
    })
  }
})
