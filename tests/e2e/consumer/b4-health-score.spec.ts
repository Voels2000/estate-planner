import { test, expect } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreContextSentence } from '@/lib/estate-health-score'
import { initSupabaseEnv } from '../../../scripts/seed-e2e-lib'

const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID

test.describe.configure({ mode: 'serial' })

test.describe('B4 health score behaviors', () => {
  test('stale score shows recalculate prompt after 31-day computed_at', async ({ page }) => {
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID')
    initSupabaseEnv()
    const admin = createAdminClient()
    const staleAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()

    const { data: before } = await admin
      .from('estate_health_scores')
      .select('computed_at, score')
      .eq('household_id', householdId!)
      .single()

    await admin
      .from('estate_health_scores')
      .update({ computed_at: staleAt })
      .eq('household_id', householdId!)

    await page.route('**/api/recompute-estate-health', (route) => route.abort())

    try {
      await page.goto('/dashboard')
      await expect(page.getByTestId('estate-score-stale-banner')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('estate-score-stale-banner')).toContainText(
        /Recalculate your score/i,
      )
    } finally {
      if (before?.computed_at) {
        await admin
          .from('estate_health_scores')
          .update({ computed_at: before.computed_at, score: before.score ?? 85 })
          .eq('household_id', householdId!)
      }
    }
  })

  test('dashboard shows score, context copy, and readiness label', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/Estate readiness \d+\/100/i).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId('estate-score-context')).toBeVisible()
    const context = await page.getByTestId('estate-score-context').textContent()
    expect(context?.length).toBeGreaterThan(20)
    expect(context).toMatch(/estate|plan|gaps|risks/i)
  })

  test('my-estate-strategy shows readiness badge', async ({ page }) => {
    await page.goto('/my-estate-strategy')
    await expect(page.getByText(/Estate readiness \d+\/100/i).first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('health-check wizard shows completion question copy', async ({ page }) => {
    await page.goto('/health-check')
    await expect(page.getByText('Estate Health Check')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Do you have a current will?')).toBeVisible()
  })

  test('score context sentence matches tier for seeded score', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('estate-score-context')).toBeVisible({ timeout: 30_000 })
    const text = await page.getByTestId('estate-score-context').textContent()
    expect(text).toBe(scoreContextSentence(85))
  })
})
