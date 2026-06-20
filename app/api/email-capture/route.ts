import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, clientIp } from '@/lib/api/simpleRateLimit'
import { internalApiHeaders } from '@/lib/api/internalApiAuth'
import { requestHasGpcMarketingOptOut } from '@/lib/privacy/readGpcOptOut'

const EMAIL_CAPTURE_RATE_LIMIT = { max: 10, windowMs: 60_000 }

function isMarketingDripSource(source: unknown): boolean {
  return source !== 'waitlist'
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rate = await checkRateLimit(`email-capture:${ip}`, EMAIL_CAPTURE_RATE_LIMIT.max, EMAIL_CAPTURE_RATE_LIMIT.windowMs)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rate.retryAfterSec ? { 'Retry-After': String(rate.retryAfterSec) } : undefined },
      )
    }

    const body = await req.json()
    const { email, source, score } = body
    const gpcOptOut = requestHasGpcMarketingOptOut(req)
    const marketingDrip = isMarketingDripSource(source)

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const capturedAt = new Date().toISOString()

    const { error } = await supabase
      .from('email_captures')
      .insert({
        email: email.trim().toLowerCase(),
        source: source ?? 'unknown',
        score: typeof score === 'number' ? score : null,
        captured_at: capturedAt,
        ...(gpcOptOut && marketingDrip ? { unsubscribed_at: capturedAt } : {}),
      })

    if (error) {
      console.error('[email-capture] insert failed:', error.code, error.message)
      if (!error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'Could not save' }, { status: 500 })
      }
    }

    if (marketingDrip && !gpcOptOut) {
      fetch(`https://mywealthmaps.com/api/email/drip`, {
        method: 'POST',
        headers: internalApiHeaders(),
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          source: source ?? 'unknown',
          event_slug: source?.replace('event-assess-', '') ?? null,
          sequence_step: 1,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[email-capture] route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
