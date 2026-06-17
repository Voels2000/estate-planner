import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdvisorDripStep } from '@/lib/advisor/sendAdvisorDripStep'
import { requireCronOrInternal } from '@/lib/api/internalApiAuth'

/**
 * POST /api/email/advisor-drip
 *
 * Body: { advisor_id: string, sequence_step: 1 | 2 | 3 }
 * Auth: CRON_SECRET or INTERNAL_API_KEY
 */
export async function POST(req: NextRequest) {
  const denied = requireCronOrInternal(req)
  if (denied) return denied

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  const { advisor_id, sequence_step } = await req.json()

  if (!advisor_id || ![1, 2, 3].includes(sequence_step)) {
    return NextResponse.json(
      { error: 'advisor_id and sequence_step (1|2|3) required' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const result = await sendAdvisorDripStep(admin, advisor_id, sequence_step)

  if (!result.ok) {
    return NextResponse.json({ ok: false, skipped: result.skipped ?? 'unknown' }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
