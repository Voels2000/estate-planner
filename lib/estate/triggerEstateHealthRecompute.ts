const LOG_PREFIX = '[triggerEstateHealthRecompute]'

const recomputeTimers = new Map<string, ReturnType<typeof setTimeout>>()
const DEBOUNCE_MS = 3000

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/$/, '')
}

/** Log once per process when production env is missing recompute config. */
let loggedMisconfigured = false

function logMisconfiguredEnv(householdId: string): void {
  if (!isProduction() || loggedMisconfigured) return
  loggedMisconfigured = true
  console.warn(`${LOG_PREFIX} skipped — missing production env:`, {
    householdId,
    hasRecomputeSecret: Boolean(process.env.RECOMPUTE_SECRET),
    hasAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  })
}

function shouldLogHttpError(status: number): boolean {
  // 403 is expected in dev without RECOMPUTE_SECRET; still log in production.
  if (status === 403 && !isProduction()) return false
  return true
}

async function runRecomputeHttp(householdId: string, appUrl: string): Promise<void> {
  const secret = process.env.RECOMPUTE_SECRET ?? ''
  const baseUrl = appUrl?.trim()

  if (!secret || !baseUrl) {
    logMisconfiguredEnv(householdId)
    return
  }

  const url = `${normalizeAppUrl(baseUrl)}/api/recompute-estate-health`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-recompute-secret': secret,
      },
      body: JSON.stringify({ householdId }),
    })

    if (!res.ok) {
      if (!shouldLogHttpError(res.status)) return
      const body = await res.text().catch(() => '')
      console.error(`${LOG_PREFIX} non-ok response:`, {
        householdId,
        status: res.status,
        statusText: res.statusText,
        url,
        body: body.slice(0, 500),
      })
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} fetch failed:`, {
      householdId,
      url,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Fire-and-forget estate health + conflict recompute for a household.
 * Debounced per householdId (3s) to avoid recompute storms on rapid saves.
 * Saves are not blocked if this fails; failures are logged for operations/debugging.
 */
export async function triggerEstateHealthRecompute(
  householdId: string,
  appUrl: string,
): Promise<void> {
  const existing = recomputeTimers.get(householdId)
  if (existing) clearTimeout(existing)

  recomputeTimers.set(
    householdId,
    setTimeout(() => {
      recomputeTimers.delete(householdId)
      void runRecomputeHttp(householdId, appUrl)
    }, DEBOUNCE_MS),
  )
}
