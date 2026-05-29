import { createHash } from 'crypto'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/** Best-effort in-memory rate limit (per serverless instance). */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now()
  const hashed = createHash('sha256').update(key).digest('hex').slice(0, 32)
  const entry = buckets.get(hashed)

  if (!entry || now > entry.resetAt) {
    buckets.set(hashed, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count += 1
  return { allowed: true }
}
