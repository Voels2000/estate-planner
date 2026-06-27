/**
 * At-failure classifier for advisor specs. On a FAILED test, emits one
 * `advisor-failure-diag` line that splits the failure into:
 *
 *   AUTH_SESSION_CLEARED  — landed on /login or the auth cookie is empty.
 *   AUTH_REFRESH_FAILED   — a /auth/v1/token refresh call 4xx'd during the test.
 *   AUTH_401_HEALTHY_COOKIE — saw a 401 but the cookie is still full and no refresh failed.
 *   RENDER_OR_TIMING      — right URL, cookie healthy, no 401, no failed refresh.
 *
 * Observational only — never calls refreshSession/getUser or redeems a token.
 */
import type { test as BaseTest } from '@playwright/test'

type Resp = { url: string; status: number }

const buffers = new Map<string, Resp[]>()

const TOKEN_ENDPOINT = /\/auth\/v1\/token/
const AUTH_COOKIE = /sb-.*-auth-token(\.\d+)?$/

export function installAdvisorFailureDiag(t: typeof BaseTest) {
  t.beforeEach(async ({ page }, testInfo) => {
    const buf: Resp[] = []
    buffers.set(testInfo.testId, buf)
    page.on('response', (response) => {
      buf.push({ url: response.url(), status: response.status() })
    })
  })

  t.afterEach(async ({ page }, testInfo) => {
    const buf = buffers.get(testInfo.testId) ?? []
    buffers.delete(testInfo.testId)
    if (testInfo.status === testInfo.expectedStatus) return

    const cookies = await page.context().cookies().catch(() => [] as { name: string; value: string }[])
    const authCookieLen = cookies
      .filter((cookie) => AUTH_COOKIE.test(cookie.name))
      .reduce((total, cookie) => total + (cookie.value?.length ?? 0), 0)

    let finalUrl = ''
    try {
      finalUrl = page.url()
    } catch {
      // page may be closed
    }
    const isLogin = /\/login/.test(finalUrl)

    const refreshCalls = buf.filter((entry) => TOKEN_ENDPOINT.test(entry.url))
    const failedRefresh = refreshCalls.filter((entry) => entry.status >= 400)
    const got401 = buf.filter((entry) => entry.status === 401).map((entry) => entry.url)

    const signal =
      isLogin || authCookieLen === 0
        ? 'AUTH_SESSION_CLEARED'
        : failedRefresh.length > 0
          ? 'AUTH_REFRESH_FAILED'
          : got401.length > 0
            ? 'AUTH_401_HEALTHY_COOKIE'
            : 'RENDER_OR_TIMING'

    console.log(
      `advisor-failure-diag ${JSON.stringify({
        test: testInfo.title,
        signal,
        finalUrl,
        isLogin,
        authCookieLen,
        refreshCalls: refreshCalls.length,
        failedRefresh: failedRefresh.map((entry) => entry.status),
        got401,
        lastResponses: buf.slice(-6),
      })}`,
    )
  })
}

/** Request-context snapshot when page stream is empty (e.g. isolation gifting-summary 401). */
export async function logRequestAuthSnapshot(
  ctx: { storageState: () => Promise<{ cookies: { name: string; value: string }[] }> },
  label: string,
  status: number,
) {
  const state = await ctx.storageState().catch(() => ({ cookies: [] as { name: string; value: string }[] }))
  const authCookieLen = state.cookies
    .filter((cookie) => AUTH_COOKIE.test(cookie.name))
    .reduce((total, cookie) => total + (cookie.value?.length ?? 0), 0)

  console.log(
    `advisor-request-auth-snapshot ${JSON.stringify({
      label,
      status,
      authCookieLen,
      signal:
        status === 401 && authCookieLen > 0
          ? 'ROUTE_OR_AUTHZ_NOT_SESSION'
          : status === 401
            ? 'NO_AUTH_COOKIE_ON_CONTEXT'
            : 'OK',
    })}`,
  )
}
