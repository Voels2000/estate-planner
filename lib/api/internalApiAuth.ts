import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

/** Constant-time compare; hash first so lengths need not match. */
export function safeCompareSecrets(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

/**
 * Fail closed when `expected` is unset; constant-time compare otherwise.
 * Returns null when authorized.
 */
export function requireHeaderSecretAuth(
  provided: string,
  expected: string | undefined,
  opts?: { forbiddenStatus?: 401 | 403 },
): NextResponse | null {
  if (!expected) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (safeCompareSecrets(provided, expected)) return null
  const status = opts?.forbiddenStatus ?? 403
  return NextResponse.json(
    { error: status === 401 ? 'Unauthorized' : 'Forbidden' },
    { status },
  )
}

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  return safeCompareSecrets(header, `Bearer ${secret}`)
}

function isInternalApiAuthorized(req: Request): boolean {
  const key = process.env.INTERNAL_API_KEY
  if (!key) return false
  const provided = req.headers.get('x-internal-key') ?? ''
  return safeCompareSecrets(provided, key)
}

/** Headers for server-to-server calls to internal-only API routes. */
export function internalApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
  }
}

export function isInternalApiRequest(req: Request): boolean {
  return isInternalApiAuthorized(req)
}

export function requireInternalApi(req: Request): NextResponse | null {
  return requireHeaderSecretAuth(
    req.headers.get('x-internal-key') ?? '',
    process.env.INTERNAL_API_KEY,
  )
}

/** Cron jobs only — Bearer CRON_SECRET. Fails closed when secret unset. */
export function requireCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const header = req.headers.get('authorization') ?? ''
  if (safeCompareSecrets(header, `Bearer ${secret}`)) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/** Estate health recompute — x-recompute-secret. Fails closed when secret unset. */
export function requireRecomputeAuth(req: Request): NextResponse | null {
  return requireHeaderSecretAuth(
    req.headers.get('x-recompute-secret') ?? '',
    process.env.RECOMPUTE_SECRET,
  )
}

/** Cron jobs and configured webhooks may use CRON_SECRET as Bearer token. */
export function isCronOrInternalRequest(req: Request): boolean {
  return isCronAuthorized(req) || isInternalApiAuthorized(req)
}

export function requireCronOrInternal(req: Request): NextResponse | null {
  if (isCronAuthorized(req) || isInternalApiAuthorized(req)) return null

  const hasCron = !!process.env.CRON_SECRET
  const hasInternal = !!process.env.INTERNAL_API_KEY
  if (!hasCron && !hasInternal) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
