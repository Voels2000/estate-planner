import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  return safeEqual(header, `Bearer ${secret}`)
}

function isInternalApiAuthorized(req: Request): boolean {
  const key = process.env.INTERNAL_API_KEY
  if (!key) return false
  const provided = req.headers.get('x-internal-key') ?? ''
  return safeEqual(provided, key)
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
  const key = process.env.INTERNAL_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (isInternalApiAuthorized(req)) return null
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/** Cron jobs only — Bearer CRON_SECRET. Fails closed when secret unset. */
export function requireCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (isCronAuthorized(req)) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
