import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAttorneyDripStep, sendAttorneyDripStepByEmail } from '@/lib/attorney/sendAttorneyDripStep'
import { requireCronOrInternal } from '@/lib/api/internalApiAuth'

/**
 * POST /api/email/attorney-drip
 *
 * Body: { email?: string, attorney_id?: string, sequence_step: 1 | 2 | 3 }
 * Auth: CRON_SECRET or INTERNAL_API_KEY
 */
export async function POST(req: NextRequest) {
  const denied = requireCronOrInternal(req)
  if (denied) return denied

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  const body = (await req.json()) as {
    email?: string
    attorney_id?: string
    sequence_step?: number
  }

  const { email, attorney_id, sequence_step } = body

  if (![1, 2, 3].includes(sequence_step ?? 0)) {
    return NextResponse.json({ error: 'sequence_step (1|2|3) required' }, { status: 400 })
  }

  if (!email && !attorney_id) {
    return NextResponse.json({ error: 'email or attorney_id required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const result = attorney_id
    ? await sendAttorneyDripStep(admin, attorney_id, sequence_step as 1 | 2 | 3)
    : await sendAttorneyDripStepByEmail(admin, email!, sequence_step as 1 | 2 | 3)

  if (!result.ok) {
    return NextResponse.json({ skipped: true, reason: result.skipped ?? 'unknown' })
  }

  return NextResponse.json({ success: true, step: sequence_step })
}
