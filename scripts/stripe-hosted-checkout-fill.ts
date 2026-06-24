import type { Page } from 'playwright'

/** Fill Stripe hosted checkout (US billing + test card). Uncheck Link save-info. */
export async function fillStripeHostedCheckout(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 })
  await page.waitForTimeout(2000)

  const enterManual = page.getByRole('button', { name: /enter address manually/i })
  if (await enterManual.isVisible().catch(() => false)) {
    await enterManual.click()
    await page.waitForTimeout(500)
  }

  const country = page.getByLabel(/^Country$/i)
  if (await country.isVisible().catch(() => false)) {
    await country.selectOption('US')
  }
  if (await page.getByRole('textbox', { name: /address line 1/i }).isVisible().catch(() => false)) {
    await page.getByRole('textbox', { name: /address line 1/i }).fill('123 Test Street')
    await page.getByRole('textbox', { name: /^City$/i }).fill('Seattle')
    await page.getByRole('textbox', { name: /ZIP|postal code/i }).fill('98101')
    await page.getByLabel(/^State$/i).selectOption('WA')
  }

  await page.getByPlaceholder('1234 1234 1234 1234').fill('4242424242424242')
  await page.getByPlaceholder('MM / YY').fill('12 / 34')
  await page.getByPlaceholder('CVC').fill('123')
  await page.getByPlaceholder(/full name on card/i).fill('E2E Consumer')

  const saveInfo = page.getByRole('checkbox', { name: /save my information/i })
  if (await saveInfo.isChecked().catch(() => false)) {
    await saveInfo.uncheck()
  }

  const submit = page
    .getByRole('button', { name: /^Pay$/i })
    .or(page.getByRole('button', { name: /^Subscribe$/i }))
    .or(page.getByTestId('hosted-payment-submit-button'))
  await submit.first().click()
}
