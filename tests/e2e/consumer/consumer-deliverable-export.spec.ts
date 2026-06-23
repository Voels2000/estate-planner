import { test, expect } from '@playwright/test'
import { resolveConsumerHouseholdId } from '../helpers/e2e-households'
import { planAndExportAmountCents } from '@/lib/billing/oneTimePurchases'
import { computePlanExportEditWindowEndsAt } from '@/lib/billing/planExportAccess'
import {
  deferPlanAndExportPurchase,
  deferProfileAccessRestore,
  fetchHouseholdById,
  SOCIAL_SECURITY_GATE_ACCESS,
} from '../helpers/supabase-fixture'

test.describe.configure({ mode: 'serial' })

async function withConsumerOwner(run: (ownerId: string, householdId: string) => Promise<void>) {
  const householdId = await resolveConsumerHouseholdId()
  test.skip(!householdId, 'Run npm run seed:e2e on target env')
  const household = await fetchHouseholdById(householdId!)
  test.skip(!household, 'Could not load consumer household')
  await run(household!.owner_id, householdId!)
}

test.describe('deliverable export gate', () => {
  test('tier-1 consumer sees gated /print UI', async ({ page }) => {
    await withConsumerOwner(async (ownerId) => {
      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await page.goto('/print')
        await expect(page.getByTestId('deliverable-export-gated')).toBeVisible()
        await expect(page.getByTestId('deliverable-export-ready')).toHaveCount(0)
        await expect(page.getByTestId('plan-and-export-cta')).toBeVisible()
        await expect(page.getByText(/counts toward your subscription/i)).toBeVisible()
      })
    })
  })

  test('trialing consumer sees gated /print UI and API 403s generate', async ({
    page,
    request,
  }) => {
    await withConsumerOwner(async (ownerId, householdId) => {
      await deferProfileAccessRestore(
        ownerId,
        {
          consumer_tier: 3,
          subscription_status: 'trialing',
          subscription_plan: null,
        },
        async () => {
          await page.goto('/print')
          await expect(page.getByTestId('deliverable-export-gated')).toBeVisible()

          const res = await request.get(
            `/api/export-estate-plan?household_id=${encodeURIComponent(householdId)}`,
          )
          expect(res.status()).toBe(403)
        },
      )
    })
  })

  test('completed Plan & Export purchase unlocks /print without active sub', async ({
    page,
  }) => {
    await withConsumerOwner(async (ownerId) => {
      const sessionId = `e2e_plan_export_${Date.now()}`
      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await deferPlanAndExportPurchase(
          ownerId,
          sessionId,
          planAndExportAmountCents(),
          async () => {
            await page.goto('/print')
            await expect(page.getByTestId('deliverable-export-ready')).toBeVisible()
            await expect(page.getByTestId('plan-and-export-cta')).toHaveCount(0)
          },
        )
      })
    })
  })

  test('expired edit window shows download-only /print UI', async ({ page }) => {
    await withConsumerOwner(async (ownerId) => {
      const sessionId = `e2e_plan_export_expired_${Date.now()}`
      const purchasedAt = new Date('2020-01-01T12:00:00.000Z')
      const editWindowEndsAt = new Date('2020-04-01T12:00:00.000Z').toISOString()

      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await deferPlanAndExportPurchase(
          ownerId,
          sessionId,
          planAndExportAmountCents(),
          async () => {
            await page.goto('/print')
            await expect(page.getByTestId('deliverable-export-download-only')).toBeVisible()
          },
          { purchasedAt, editWindowEndsAt },
        )
      })
    })
  })

  test('expired edit window API 403s generate', async ({ request }) => {
    await withConsumerOwner(async (ownerId, householdId) => {
      const sessionId = `e2e_plan_export_api_${Date.now()}`
      const purchasedAt = new Date('2020-01-01T12:00:00.000Z')
      const editWindowEndsAt = computePlanExportEditWindowEndsAt(purchasedAt).toISOString()

      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await deferPlanAndExportPurchase(
          ownerId,
          sessionId,
          planAndExportAmountCents(),
          async () => {
            const res = await request.get(
              `/api/export-estate-plan?household_id=${encodeURIComponent(householdId)}`,
            )
            expect(res.status()).toBe(403)
            const body = await res.json()
            expect(body.error).toMatch(/editing window ended/i)
          },
          { purchasedAt, editWindowEndsAt },
        )
      })
    })
  })

  test('plan export window banner shows within final 14 days', async ({ page }) => {
    await withConsumerOwner(async (ownerId) => {
      const sessionId = `e2e_plan_export_banner_${Date.now()}`
      const purchasedAt = new Date()
      purchasedAt.setUTCDate(purchasedAt.getUTCDate() - 80)
      const editWindowEndsAt = new Date()
      editWindowEndsAt.setUTCDate(editWindowEndsAt.getUTCDate() + 10)

      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await deferPlanAndExportPurchase(
          ownerId,
          sessionId,
          planAndExportAmountCents(),
          async () => {
            await page.goto('/dashboard')
            await expect(page.getByTestId('plan-export-window-banner')).toBeVisible()
          },
          { purchasedAt, editWindowEndsAt: editWindowEndsAt.toISOString() },
        )
      })
    })
  })

  test('plan export window banner hidden before final 14 days', async ({ page }) => {
    await withConsumerOwner(async (ownerId) => {
      const sessionId = `e2e_plan_export_no_banner_${Date.now()}`
      const purchasedAt = new Date()
      purchasedAt.setUTCDate(purchasedAt.getUTCDate() - 10)

      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await deferPlanAndExportPurchase(
          ownerId,
          sessionId,
          planAndExportAmountCents(),
          async () => {
            await page.goto('/dashboard')
            await expect(page.getByTestId('plan-export-window-banner')).toHaveCount(0)
          },
          { purchasedAt },
        )
      })
    })
  })

  test('plan export buy CTA POSTs sku and opens Stripe checkout', async ({ page }) => {
    await withConsumerOwner(async (ownerId) => {
      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await page.goto('/print')
        await expect(page.getByTestId('plan-and-export-cta')).toBeVisible()

        const checkoutResponse = page.waitForResponse(
          (res) =>
            res.url().includes('/api/stripe/checkout') && res.request().method() === 'POST',
        )
        await page.getByRole('button', { name: /Buy Plan & Export/i }).click()
        const res = await checkoutResponse
        const body = res.request().postDataJSON() as Record<string, unknown>
        expect(body).toMatchObject({ sku: 'plan_and_export', returnTo: '/print' })

        if (!res.ok()) {
          const detail = await res.text()
          test.skip(
            detail.includes('No Stripe price configured'),
            'STRIPE_PRICE_PLAN_AND_EXPORT not set on this deployment',
          )
          expect(res.ok(), detail).toBeTruthy()
        }

        await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 })
      })
    })
  })

  test('privacy portability request path reachable for tier-1 consumer', async ({ page }) => {
    await withConsumerOwner(async (ownerId) => {
      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await page.goto('/settings/security')
        await expect(page.getByRole('heading', { name: 'Privacy rights' })).toBeVisible()
        await expect(page.getByRole('combobox', { name: 'Request type' })).toContainText(
          'Export my data (portability)',
        )
      })
    })
  })
})
