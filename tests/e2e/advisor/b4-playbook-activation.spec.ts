import { test, expect } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  findUserIdByEmail,
  initSupabaseEnv,
  linkAdvisorToClient,
} from '../../../scripts/seed-e2e-lib'
import { syncE2ePasswordForEmail } from '../helpers/e2e-auth'

const emptyAdvisor = E2E_IDENTITIES.advisor

test.describe.configure({ mode: 'serial', timeout: 120_000 })

async function loginAdvisorEmpty(page: import('@playwright/test').Page) {
  await syncE2ePasswordForEmail(emptyAdvisor.email, emptyAdvisor.password)
  await page.goto('/login')
  await page.locator('input[id="email"]').fill(emptyAdvisor.email)
  await page.locator('input[id="password"]').fill(emptyAdvisor.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
}

test.describe('B4 advisor playbook', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeAll(async () => {
    initSupabaseEnv()
    const advisorId = await findUserIdByEmail(emptyAdvisor.email)
    if (!advisorId) return
    const admin = createAdminClient()
    await admin.from('advisor_clients').delete().eq('advisor_id', advisorId)
  })

  test('zero-client advisor sees three empty-state options', async ({ page, context }) => {
    await context.clearCookies()
    await loginAdvisorEmpty(page)
    await page.goto('/advisor')
    await expect(page.getByText('Connect your first client')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Send an intake request')).toBeVisible()
    await expect(page.getByText('Invite an existing client')).toBeVisible()
    await expect(page.getByText('Run a prospect analysis first')).toBeVisible()
  })

  test('after linking first client — playbook panel and needs-attention for low score', async ({
    page,
    context,
  }) => {
    initSupabaseEnv()
    const admin = createAdminClient()
    const advisorId = await findUserIdByEmail(emptyAdvisor.email)
    const tier1Id = await findUserIdByEmail(E2E_IDENTITIES.consumerTier1.email)
    test.skip(!advisorId || !tier1Id, 'Run npm run seed:e2e on target env')

    await admin.from('advisor_clients').delete().eq('advisor_id', advisorId!)
    await linkAdvisorToClient(advisorId!, tier1Id!)

    await context.clearCookies()
    await loginAdvisorEmpty(page)
    await page.goto('/advisor')
    await expect(page.getByText(/Getting started with/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Review their estate health score')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open client view →' })).toBeVisible()

    await expect(page.getByText(/Needs attention/i)).toBeVisible({ timeout: 15_000 })
  })

  test.afterAll(async () => {
    initSupabaseEnv()
    const advisorId = await findUserIdByEmail(emptyAdvisor.email)
    if (!advisorId) return
    const admin = createAdminClient()
    await admin.from('advisor_clients').delete().eq('advisor_id', advisorId)
  })
})
