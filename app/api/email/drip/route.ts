import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDripSequence, buildDripEmailHtml } from '@/lib/emails/drip-templates'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribeToken'
import { requireCronOrInternal } from '@/lib/api/internalApiAuth'

const BASE_URL = 'https://mywealthmaps.com'

const DRIP_SENT_COLUMNS = {
  1: 'drip_step_1_sent_at',
  2: 'drip_step_2_sent_at',
  3: 'drip_step_3_sent_at',
} as const

/**
 * POST /api/email/drip
 *
 * Sends the next email in a drip sequence for a given email capture.
 * Called by the cron job or directly after email capture.
 *
 * Body: { email: string, event_slug: string | null, sequence_step: 1 | 2 | 3 }
 */
export async function POST(req: NextRequest) {
  try {
    const denied = requireCronOrInternal(req)
    if (denied) return denied

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { email, event_slug, sequence_step, source } = await req.json()

    if (!email || ![1, 2, 3].includes(sequence_step)) {
      return NextResponse.json({ error: 'email and sequence_step (1|2|3) required' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const captureSource = typeof source === 'string' ? source : null
    const sequence = getDripSequence(event_slug ?? null)
    const emailData =
      sequence_step === 1
        ? sequence.email1
        : sequence_step === 2
          ? sequence.email2
          : sequence.email3

    const unsubscribeUrl = buildUnsubscribeUrl(BASE_URL, normalizedEmail)

    const html = buildDripEmailHtml({
      email: emailData,
      recipientEmail: normalizedEmail,
      unsubscribeUrl,
    })

    const { data, error } = await resend.emails.send({
      from: 'My Wealth Maps <hello@mywealthmaps.com>',
      to: normalizedEmail,
      subject: emailData.subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Email send failed', detail: error }, { status: 500 })
    }

    const admin = createAdminClient()
    const sentColumn = DRIP_SENT_COLUMNS[sequence_step as 1 | 2 | 3]
    let updateQuery = admin
      .from('email_captures')
      .update({ [sentColumn]: new Date().toISOString() })
      .eq('email', normalizedEmail)
    if (captureSource) {
      updateQuery = updateQuery.eq('source', captureSource)
    }
    const { error: updateError } = await updateQuery

    if (updateError) {
      console.error('email_captures drip log error:', updateError.message)
    }

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err) {
    console.error('drip route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
