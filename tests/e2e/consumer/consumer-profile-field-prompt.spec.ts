import { test, expect, type Page } from '@playwright/test'
import { resolveConsumerHouseholdId } from '../helpers/e2e-households'
import {
  deferProfileAccessRestore,
  fetchHouseholdById,
  patchHouseholdById,
  pickDeferredFields,
  restoreHouseholdDeferredFields,
  SOCIAL_SECURITY_GATE_ACCESS,
  SOCIAL_SECURITY_PROMPT_ACCESS,
  type HouseholdDeferredFields,
} from '../helpers/supabase-fixture'

/**
 * ProfileFieldPrompt UI — /scenarios and /social-security inline deferred fields.
 * Resolves e2e-consumer household canonically (not PLAYWRIGHT_HOUSEHOLD_ID).
 *
 * Run (go-live bundle): npm run test:e2e:go-live-profile
 *
 * Staging cast drift: `npm run reset:staging-stripe` sets subscription_status='none'
 * on @mywealthmaps.test profiles (Stripe re-key hygiene). Re-seed with `npm run seed:e2e`
 * or SS prompt tests temporarily elevate tier inside deferProfileAccessRestore.
 */
test.describe.configure({ mode: 'serial' })

const PROMPT_SCENARIOS = 'Personalize your projection'
const SCENARIOS_PROMPT_KEY = 'mwm_prompt_dismissed_scenarios_planning'
const SS_PROMPT_KEY = 'mwm_prompt_dismissed_ss_person1'

function scenariosPromptCard(page: Page) {
  return page.locator('div.mb-6.rounded-lg').filter({ hasText: PROMPT_SCENARIOS })
}

function ssPromptCard(page: Page, personPattern: RegExp) {
  return page.locator('div.mb-6.rounded-lg').filter({ hasText: personPattern }).first()
}

async function ensurePromptNotDismissed(page: Page, keys: string[], path: string) {
  await page.goto(path)
  await page.evaluate((storageKeys: string[]) => {
    for (const key of storageKeys) sessionStorage.removeItem(key)
  }, keys)
  await page.reload()
}

async function deferRestore(
  householdId: string,
  patch: Record<string, unknown>,
  run: () => Promise<void>,
) {
  const before = await fetchHouseholdById(householdId)
  test.skip(!before, 'Could not load household row')
  const snapshot = pickDeferredFields(before!)
  await patchHouseholdById(householdId, patch)
  try {
    await run()
  } finally {
    await restoreHouseholdDeferredFields(householdId, snapshot)
  }
}

async function withHouseholdOwner(
  householdId: string,
  run: (ownerId: string) => Promise<void>,
): Promise<void> {
  const household = await fetchHouseholdById(householdId)
  test.skip(!household, 'Could not load household row')
  await run(household!.owner_id)
}

async function withSocialSecurityPromptAccess(
  householdId: string,
  run: () => Promise<void>,
): Promise<void> {
  await withHouseholdOwner(householdId, async (ownerId) => {
    await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_PROMPT_ACCESS, run)
  })
}

test.describe('ProfileFieldPrompt — Scenarios', () => {
  let householdId = ''

  test.beforeAll(async ({}, testInfo) => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      testInfo.skip(true, 'SUPABASE_SERVICE_ROLE_KEY required')
      return
    }
    householdId = (await resolveConsumerHouseholdId()) ?? ''
    if (!householdId) {
      testInfo.skip(true, 'Could not resolve canonical consumer household — run npm run seed:e2e')
    }
  })

  test('shows longevity prompt when unset; save persists and hides card', async ({ page }) => {
    await deferRestore(householdId, { person1_longevity_age: null }, async () => {
      await ensurePromptNotDismissed(page, [SCENARIOS_PROMPT_KEY], '/scenarios')
      await expect(page.getByRole('heading', { name: /scenario/i })).toBeVisible({
        timeout: 20_000,
      })

      const card = scenariosPromptCard(page)
      await expect(card).toBeVisible()
      const form = card.locator('form')
      await expect(form.getByText('Planning horizon age (you)')).toBeVisible()
      await form.getByPlaceholder('e.g. 90').fill('92')
      await form.getByRole('button', { name: /^Save$/i }).click()

      await expect(card).toBeHidden({ timeout: 15_000 })

      const after = await fetchHouseholdById(householdId)
      expect(after?.person1_longevity_age).toBe(92)
    })
  })

  test('does not prompt deduction when standard is explicitly set', async ({ page }) => {
    await deferRestore(
      householdId,
      { deduction_mode: 'standard', person1_longevity_age: 90 },
      async () => {
        await ensurePromptNotDismissed(page, [SCENARIOS_PROMPT_KEY], '/scenarios')
        await expect(page.getByRole('heading', { name: /scenario/i })).toBeVisible({
          timeout: 20_000,
        })
        await expect(scenariosPromptCard(page)).toBeHidden()
      },
    )
  })

  test('custom deduction follow-on saves amount via partial PATCH', async ({ page }) => {
    await deferRestore(
      householdId,
      { deduction_mode: null, person1_longevity_age: 90 },
      async () => {
        await ensurePromptNotDismissed(page, [SCENARIOS_PROMPT_KEY], '/scenarios')

        const card = scenariosPromptCard(page)
        await expect(card).toBeVisible({ timeout: 20_000 })
        const form = card.locator('form')

        await form.locator('select').selectOption('custom')
        await expect(form.getByText('Custom annual deduction amount')).toBeVisible()
        await form.getByPlaceholder('e.g. 45000').fill('45000')
        await form.getByRole('button', { name: /^Save$/i }).click()

        await expect(card).toBeHidden({ timeout: 15_000 })

        const after = await fetchHouseholdById(householdId)
        expect(after?.deduction_mode).toBe('custom')
        expect(after?.custom_deduction_amount).toBe(45000)
      },
    )
  })

  test('Remind me later dismisses for session; reappears after sessionStorage cleared', async ({
    page,
  }) => {
    await deferRestore(householdId, { person1_longevity_age: null }, async () => {
      await ensurePromptNotDismissed(page, [SCENARIOS_PROMPT_KEY], '/scenarios')

      const card = scenariosPromptCard(page)
      await expect(card).toBeVisible({ timeout: 20_000 })

      await card.getByRole('button', { name: /remind me later/i }).click()
      await expect(card).toBeHidden()

      await page.reload()
      await expect(card).toBeHidden()

      await page.evaluate((key) => sessionStorage.removeItem(key), SCENARIOS_PROMPT_KEY)
      await page.reload()
      await expect(card).toBeVisible({ timeout: 15_000 })
    })
  })
})

test.describe('ProfileFieldPrompt — Social Security', () => {
  let householdId = ''

  test.beforeAll(async ({}, testInfo) => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      testInfo.skip(true, 'SUPABASE_SERVICE_ROLE_KEY required')
      return
    }
    householdId = (await resolveConsumerHouseholdId()) ?? ''
    if (!householdId) {
      testInfo.skip(true, 'Could not resolve canonical consumer household — run npm run seed:e2e')
    }
  })

  test('inactive subscription shows upgrade banner (tier gate)', async ({ page }) => {
    await withHouseholdOwner(householdId, async (ownerId) => {
      await deferProfileAccessRestore(ownerId, SOCIAL_SECURITY_GATE_ACCESS, async () => {
        await page.goto('/social-security')
        await expect(page.getByText(/Upgrade to unlock/i)).toBeVisible({ timeout: 15_000 })
        await expect(page.getByTestId('upgrade-banner')).toBeVisible()
        await expect(page.getByTestId('profile-field-prompt')).toHaveCount(0)
      })
    })
  })

  test('shows person-1 prompt when SS fields unset; save updates calculator PIA', async ({
    page,
  }) => {
    await withSocialSecurityPromptAccess(householdId, async () => {
      await deferRestore(
        householdId,
        { person1_ss_claiming_age: null, person1_ss_pia: null },
        async () => {
          await ensurePromptNotDismissed(page, [SS_PROMPT_KEY], '/social-security')
          await expect(page.getByRole('heading', { name: /social security/i })).toBeVisible({
            timeout: 20_000,
          })

          const card = ssPromptCard(page, /Alex's Social Security details/i)
          await expect(card).toBeVisible()
          const form = card.locator('form')
          await form.locator('input[type="number"]').nth(0).fill('68')
          await form.locator('input[type="number"]').nth(1).fill('2500')
          await form.getByRole('button', { name: /^Save$/i }).click()

          await expect(card).toBeHidden({ timeout: 15_000 })

          await expect.poll(async () => (await fetchHouseholdById(householdId))?.person1_ss_pia).toBe(
            2500,
          )
          await expect.poll(
            async () => (await fetchHouseholdById(householdId))?.person1_ss_claiming_age,
          ).toBe(68)

          await page.reload()
          await expect(page.getByText(/Elected age 68/i).first()).toBeVisible({ timeout: 15_000 })
          await expect(page.getByText(/PIA \$2,500\/mo/i).first()).toBeVisible({ timeout: 15_000 })

          const after = await fetchHouseholdById(householdId)
          expect(after?.person1_ss_claiming_age).toBe(68)
          expect(after?.person1_ss_pia).toBe(2500)
        },
      )
    })
  })

  test('Remind me later dismisses SS prompt for session', async ({ page }) => {
    await withSocialSecurityPromptAccess(householdId, async () => {
      await deferRestore(
        householdId,
        { person1_ss_claiming_age: null, person1_ss_pia: null },
        async () => {
          await ensurePromptNotDismissed(page, [SS_PROMPT_KEY], '/social-security')

          const card = ssPromptCard(page, /Alex's Social Security details/i)
          await expect(card).toBeVisible({ timeout: 20_000 })

          await card.getByRole('button', { name: /remind me later/i }).click()
          await expect(card).toBeHidden()

          await page.evaluate((key) => sessionStorage.removeItem(key), SS_PROMPT_KEY)
          await page.reload()
          await expect(card).toBeVisible({ timeout: 15_000 })
        },
      )
    })
  })
})
