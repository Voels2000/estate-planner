import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireCronOrInternal } from '@/lib/api/internalApiAuth'

const resend = new Resend(process.env.RESEND_API_KEY)

const FORWARD_TO = 'avoels@comcast.net'

const PERSONA_LABELS: Record<string, string> = {
  consumer1: '[TEST: Consumer T1]',
  consumer3: '[TEST: Consumer T3]',
  consumer5: '[TEST: Consumer 5]',
  consumer11: '[TEST: Consumer 11]',
  consumer15: '[TEST: Consumer 15]',
  consumer17: '[TEST: Consumer 17]',
  consumer18: '[TEST: Consumer 18]',
  consumer19: '[TEST: Consumer 19]',
  consumer20: '[TEST: Consumer 20]',
  consumer21: '[TEST: Consumer 21]',
  attorney: '[TEST: Attorney]',
  advisor2: '[TEST: Advisor 2]',
  admin: '[TEST: Admin]',
}

export const GET = async () => NextResponse.json({ ok: true })

export const POST = async (request: NextRequest) => {
  const denied = requireCronOrInternal(request)
  if (denied) return denied

  try {
    const event = await request.json()

    if (event.type === 'email.received') {
      const emailId: string = event.data.email_id
      const toAddress: string = event.data.to?.[0] ?? ''
      const persona = toAddress.split('@')[0]?.toLowerCase() ?? 'unknown'
      const label = PERSONA_LABELS[persona] ?? `[TEST: ${persona}]`

      const { data, error } = await resend.emails.receiving.forward({
        emailId,
        to: FORWARD_TO,
        from: 'onboarding@resend.dev',
      })

      if (error) {
        console.error('[Resend Inbound] Forward error:', error)
        return new NextResponse(`Error: ${error.message}`, { status: 500 })
      }

      return NextResponse.json({ forwarded: true, persona: label, data })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Resend Inbound] Unexpected error:', err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
