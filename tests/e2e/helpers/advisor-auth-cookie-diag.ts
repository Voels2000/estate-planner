import { readFileSync, existsSync } from 'fs'
import type { Page } from '@playwright/test'

type CookieSummary = {
  name: string
  domain: string
  path: string
  httpOnly: boolean
  secure: boolean
  sameSite: string
  valueLen: number
  valuePrefix: string
}

function summarizeCookies(
  cookies: Array<{
    name: string
    domain: string
    path: string
    httpOnly: boolean
    secure: boolean
    sameSite: string
    value: string
  }>,
): CookieSummary[] {
  return cookies
    .filter((c) => c.name.includes('auth-token') || c.name.includes('sb-'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
      valueLen: c.value.length,
      valuePrefix: c.value.slice(0, 24),
    }))
}

/** Log auth cookies from a browser context when E2E_DIAG_ADVISOR_COOKIES=1. */
export async function logAdvisorPageAuthCookies(page: Page, label: string): Promise<void> {
  if (process.env.E2E_DIAG_ADVISOR_COOKIES !== '1') return

  const cookies = await page.context().cookies()
  console.log(
    JSON.stringify({
      diag: 'advisor-page-auth-cookies',
      label,
      url: page.url(),
      cookies: summarizeCookies(cookies),
    }),
  )
}

/** Log auth cookies from a Playwright storage state file (API mint vs browser baseline). */
export function logStorageStateAuthCookies(storagePath: string, label: string): void {
  if (process.env.E2E_DIAG_ADVISOR_COOKIES !== '1') return
  if (!existsSync(storagePath)) {
    console.log(JSON.stringify({ diag: 'advisor-storage-state-missing', label, storagePath }))
    return
  }

  const state = JSON.parse(readFileSync(storagePath, 'utf8')) as {
    cookies?: Array<{
      name: string
      domain: string
      path: string
      httpOnly: boolean
      secure: boolean
      sameSite: string
      value: string
    }>
  }

  console.log(
    JSON.stringify({
      diag: 'advisor-storage-state-auth-cookies',
      label,
      storagePath,
      cookies: summarizeCookies(state.cookies ?? []),
    }),
  )
}

/** Compare browser-login baseline (.auth/advisor.json) to per-suite API mint on CI. */
export function logAdvisorAuthCookieComparison(suiteStoragePath: string): void {
  if (process.env.E2E_DIAG_ADVISOR_COOKIES !== '1') return
  logStorageStateAuthCookies('.auth/advisor.json', 'browser-login-baseline')
  logStorageStateAuthCookies(suiteStoragePath, 'api-mint-suite')
}
