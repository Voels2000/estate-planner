import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    console.log('[email-capture] POST received')

    const body = await req.json()
    const { email, source, score } = body
    console.log('[email-capture] body:', { email, source, score })

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.log('[email-capture] returning 400: valid email required')
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('email_captures')
      .insert({
        email: email.trim().toLowerCase(),
        source: source ?? 'unknown',
        score: typeof score === 'number' ? score : null,
        captured_at: new Date().toISOString(),
      })

    console.log('[email-capture] insert error:', error)

    // Duplicate email on same source is not an error — just ignore
    if (error) {
      console.error('[email-capture] insert failed:', error.code, error.message, error.details)
      if (!error.message.includes('duplicate')) {
        console.log('[email-capture] returning 500: could not save')
        return NextResponse.json({ error: 'Could not save' }, { status: 500 })
      }
    }

    fetch(`https://mywealthmaps.com/api/email/drip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        source: source ?? 'unknown',
        event_slug: source?.replace('event-assess-', '') ?? null,
        sequence_step: 1,
      }),
    }).catch(() => {})

    console.log('[email-capture] returning ok')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[email-capture] route error:', err)
    console.log('[email-capture] returning 500: server error')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
