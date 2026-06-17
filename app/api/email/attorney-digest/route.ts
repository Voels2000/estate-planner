import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAttorneyDigest } from '@/lib/attorney/sendAttorneyDigest'
import { requireCronOrInternal } from '@/lib/api/internalApiAuth'

/**
 * POST /api/email/attorney-digest
 *
 * Body: { attorney_id: string }
 * Auth: CRON_SECRET or INTERNAL_API_KEY
 */
export async function POST(req: NextRequest) {
  const denied = requireCronOrInternal(req)
  if (denied) return denied

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  const body = (await req.json()) as { attorney_id?: string }
  const { attorney_id } = body

  if (!attorney_id) {
    return NextResponse.json({ error: 'attorney_id required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const result = await sendAttorneyDigest(supabase, attorney_id)

  if (!result.ok) {
    return NextResponse.json({ skipped: true, reason: result.skipped ?? 'unknown' })
  }

  return NextResponse.json({ success: true })
}
