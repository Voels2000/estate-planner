/**
 * Observational request-context auth logging. Pre-request reads are taken before
 * the HTTP call; post-request reads may show empty cookies after a 401 clears them.
 */
import { createClient } from '@supabase/supabase-js'
import type { test as BaseTest } from '@playwright/test'
import {
  parseSessionFromStorageState,
  refreshTokenSuffix,
} from './e2e-auth-session'

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

/** Read-only cookie length from a Playwright storageState payload. */
function authCookieLenFromState(state: { cookies: { name: string; value: string }[] }): number {
  return state.cookies
    .filter((cookie) => AUTH_COOKIE.test(cookie.name))
    .reduce((total, cookie) => total + (cookie.value?.length ?? 0), 0)
}

function sessionExpFromState(state: { cookies: { name: string; value: string }[] }): number | null {
  const chunks = state.cookies
    .filter((c) => AUTH_COOKIE.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join('')
  if (!chunks) return null

  const raw = chunks.startsWith('base64-')
    ? Buffer.from(chunks.slice('base64-'.length), 'base64').toString('utf8')
    : decodeURIComponent(chunks)

  try {
    const s = JSON.parse(raw) as {
      expires_at?: number
      access_token?: string
    }
    if (s.expires_at) return s.expires_at
    if (s.access_token) {
      const payload = JSON.parse(
        Buffer.from(s.access_token.split('.')[1], 'base64').toString(),
      ) as { exp?: number }
      return payload.exp ?? null
    }
  } catch {
    // fall through
  }
  return null
}

/** Pre-request: auth on the exact request fixture before the HTTP call (non-mutating read). */
export async function logRequestAuthPreSnapshot(
  ctx: { storageState: () => Promise<{ cookies: { name: string; value: string }[] }> },
  label: string,
): Promise<void> {
  const state = await ctx.storageState().catch(() => ({ cookies: [] as { name: string; value: string }[] }))
  const nowUnix = Math.floor(Date.now() / 1000)
  const accessTokenExp = sessionExpFromState(state)
  console.log(
    `advisor-request-auth-pre ${JSON.stringify({
      label,
      authCookieLen: authCookieLenFromState(state),
      accessTokenExp,
      nowUnix,
      secondsUntilExp: accessTokenExp ? accessTokenExp - nowUnix : null,
      timing: 'before-request',
    })}`,
  )
}

/**
 * Standalone getUser probe from a storage file (throwaway client — does not touch
 * the Playwright request fixture). getUser only; no refreshSession.
 */
export async function logStorageStateFileGetUserProbe(storagePath: string, label: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    console.log(
      `advisor-storage-getuser-probe ${JSON.stringify({ label, storagePath, skipped: 'missing supabase env' })}`,
    )
    return
  }

  try {
    const session = parseSessionFromStorageState(storagePath)
    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    const { data, error } = await client.auth.getUser()
    console.log(
      `advisor-storage-getuser-probe ${JSON.stringify({
        label,
        storagePath,
        refreshSuffix: refreshTokenSuffix(session.refresh_token),
        userId: data.user?.id ?? session.user_id,
        getUserOk: !error && Boolean(data.user),
        getUserError: error?.message,
      })}`,
    )
  } catch (probeError) {
    console.log(
      `advisor-storage-getuser-probe ${JSON.stringify({
        label,
        storagePath,
        getUserOk: false,
        getUserError: probeError instanceof Error ? probeError.message : String(probeError),
      })}`,
    )
  }
}

/** Post-request snapshot — cookie may be empty after 401 clears the session. */
export async function logRequestAuthSnapshot(
  ctx: { storageState: () => Promise<{ cookies: { name: string; value: string }[] }> },
  label: string,
  status: number,
) {
  const state = await ctx.storageState().catch(() => ({ cookies: [] as { name: string; value: string }[] }))
  const authCookieLen = authCookieLenFromState(state)

  console.log(
    `advisor-request-auth-snapshot ${JSON.stringify({
      label,
      status,
      authCookieLen,
      timing: 'after-request',
      note:
        authCookieLen === 0 && status === 401
          ? 'post-response empty may mean server cleared cookie on 401 — compare pre-request'
          : undefined,
      signal:
        status === 401 && authCookieLen > 0
          ? 'ROUTE_OR_AUTHZ_NOT_SESSION'
          : status === 401
            ? 'POST_RESPONSE_EMPTY_INCONCLUSIVE'
            : 'OK',
    })}`,
  )
}
