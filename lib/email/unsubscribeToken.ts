import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  return process.env.CRON_SECRET ?? process.env.INTERNAL_API_KEY ?? ''
}

function signPayload(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

/** Build a signed unsubscribe URL (email + optional drip type). */
export function buildUnsubscribeUrl(
  appUrl: string,
  email: string,
  type?: 'advisor' | 'attorney',
): string {
  const normalized = email.trim().toLowerCase()
  const typePart = type ?? 'capture'
  const token = signPayload(`${normalized}:${typePart}`)
  const params = new URLSearchParams({ email: normalized, token })
  if (type) params.set('type', type)
  return `${appUrl}/api/email/unsubscribe?${params.toString()}`
}

export function verifyUnsubscribeToken(
  email: string,
  token: string | null,
  type?: 'advisor' | 'attorney' | null,
): boolean {
  if (!token || !secret()) return false
  const normalized = email.trim().toLowerCase()
  const typePart = type ?? 'capture'
  const expected = signPayload(`${normalized}:${typePart}`)
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch {
    return false
  }
}
