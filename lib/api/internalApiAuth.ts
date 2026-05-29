import { NextResponse } from 'next/server'

/** Headers for server-to-server calls to internal-only API routes. */
export function internalApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
  }
}

export function isInternalApiRequest(req: Request): boolean {
  const key = process.env.INTERNAL_API_KEY
  if (!key) return false
  return req.headers.get('x-internal-key') === key
}

export function requireInternalApi(req: Request): NextResponse | null {
  if (isInternalApiRequest(req)) return null
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/** Cron jobs and configured webhooks may use CRON_SECRET as Bearer token. */
export function isCronOrInternalRequest(req: Request): boolean {
  if (isInternalApiRequest(req)) return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export function requireCronOrInternal(req: Request): NextResponse | null {
  if (isCronOrInternalRequest(req)) return null
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
