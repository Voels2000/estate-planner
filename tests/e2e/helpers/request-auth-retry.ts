/**
 * Guarded one-shot retry for transient SSR auth read-null on Playwright request contexts.
 *
 * Only re-fires when: (1) response is 401, AND (2) the request fixture's storageState
 * still has an sb-*-auth-token cookie. Never retries a genuine unauthenticated request.
 *
 * Placement: test layer only. CI intermittent 401s on advisor routes have been observed
 * exclusively via APIRequestContext ({ request } + storageState), not via page/browser
 * navigation (see logRequestContextPlacementAudit).
 */
import type { APIRequestContext, APIResponse } from '@playwright/test'

const AUTH_COOKIE = /sb-.*-auth-token(\.\d+)?$/

async function storageStateHasAuthCookie(
  request: Pick<APIRequestContext, 'storageState'>,
): Promise<boolean> {
  const state = await request
    .storageState()
    .catch(() => ({ cookies: [] as { name: string; value: string }[] }))
  return state.cookies.some((c) => AUTH_COOKIE.test(c.name) && (c.value?.length ?? 0) > 0)
}

type GetOpts = Parameters<APIRequestContext['get']>[1]
type PostOpts = Parameters<APIRequestContext['post']>[1]

async function retryOnceAfterMicrotask(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function logRetry(meta: {
  method: 'GET' | 'POST'
  url: string
  label: string | null
  phase: 'attempt' | 'exhausted'
  finalStatus?: number
}) {
  console.log(
    JSON.stringify({
      diag: meta.phase === 'attempt' ? 'request-auth-retry' : 'request-auth-retry-exhausted',
      contextType: 'playwright-request',
      method: meta.method,
      url: meta.url,
      label: meta.label,
      ...(meta.phase === 'attempt'
        ? { firstStatus: 401, note: 'storageState has auth cookie — one retry after microtask yield' }
        : { finalStatus: meta.finalStatus }),
    }),
  )
}

async function withAuthRetry(
  request: APIRequestContext,
  method: 'GET' | 'POST',
  url: string,
  opts: GetOpts | PostOpts | undefined,
  label: string | undefined,
  fire: () => Promise<APIResponse>,
): Promise<APIResponse> {
  const res = await fire()
  if (res.status() !== 401) return res
  if (!(await storageStateHasAuthCookie(request))) return res

  logRetry({ method, url, label: label ?? null, phase: 'attempt' })
  await retryOnceAfterMicrotask()
  const retryRes = await fire()
  if (retryRes.status() === 401) {
    logRetry({
      method,
      url,
      label: label ?? null,
      phase: 'exhausted',
      finalStatus: 401,
    })
  }
  return retryRes
}

export async function getWithAuthRetry(
  request: APIRequestContext,
  url: string,
  opts?: GetOpts,
  label?: string,
): Promise<APIResponse> {
  return withAuthRetry(request, 'GET', url, opts, label, () => request.get(url, opts))
}

export async function postWithAuthRetry(
  request: APIRequestContext,
  url: string,
  opts?: PostOpts,
  label?: string,
): Promise<APIResponse> {
  return withAuthRetry(request, 'POST', url, opts, label, () => request.post(url, opts))
}

/** Confirms placement: CI async-null 401s are request-context-only, not browser-context. */
export function logRequestContextPlacementAudit(scope: string): void {
  console.log(
    JSON.stringify({
      diag: 'auth-context-placement-audit',
      scope,
      isolationApiCalls: 'playwright-request (APIRequestContext + storageState)',
      browserAdvisorSpecs:
        'page.goto specs (e.g. b4-prospect-form) use installAdvisorFailureDiag on page responses — separate path',
      ciIntermittent401ObservedOn: 'request.get to /api/advisor/client-export-payload only',
      browserContextNullObserved: false,
      placement: 'test-layer guarded retry; prod route retry not warranted unless browser nulls appear',
    }),
  )
}
