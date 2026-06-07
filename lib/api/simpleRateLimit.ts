import { createHash } from 'crypto'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type Bucket = { count: number; resetAt: number }

const memoryBuckets = new Map<string, Bucket>()
const limiterCache = new Map<string, Ratelimit>()

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!redis) redis = Redis.fromEnv()
  return redis
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

function getDistributedLimiter(max: number, windowMs: number): Ratelimit | null {
  const client = getRedis()
  if (!client) return null
  const cacheKey = `${max}:${windowMs}`
  let limiter = limiterCache.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: 'mwm-rl',
    })
    limiterCache.set(cacheKey, limiter)
  }
  return limiter
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export type RateLimitResult = { allowed: boolean; retryAfterSec?: number }

function checkMemoryRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const hashed = hashKey(key)
  const entry = memoryBuckets.get(hashed)

  if (!entry || now > entry.resetAt) {
    memoryBuckets.set(hashed, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count += 1
  return { allowed: true }
}

/** Shared rate limit — Upstash Redis when configured, else in-memory per instance. */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const limiter = getDistributedLimiter(max, windowMs)
  if (!limiter) {
    return checkMemoryRateLimit(key, max, windowMs)
  }

  const { success, reset } = await limiter.limit(hashKey(key))
  if (success) return { allowed: true }
  return {
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
  }
}

/** Synchronous memory-only helper for unit tests. */
export function checkRateLimitSync(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  return checkMemoryRateLimit(key, max, windowMs)
}
