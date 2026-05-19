import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, source, score } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const supabase = await createClient()

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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('email-capture route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
