import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, source, score } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
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

    // Duplicate email on same source is not an error — just ignore
    if (error && !error.message.includes('duplicate')) {
      console.error('email_captures insert error:', error)
      return NextResponse.json({ error: 'Could not save' }, { status: 500 })
    }

    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app'}/api/email/drip`, {
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('email-capture route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
