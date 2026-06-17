import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { fireReferralStatusUpdateNotification } from '@/lib/server-notifications'

const VALID_STATUSES = ['pending', 'contacted', 'converted', 'closed'] as const
type ReferralStatus = (typeof VALID_STATUSES)[number]

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth
  const { user } = await getAccessContext()

  const supabase = await createClient()

  const body = (await req.json()) as {
    referral_id?: string
    status?: string
    notes?: string
  }

  const { referral_id, status, notes } = body

  if (!referral_id || typeof referral_id !== 'string') {
    return NextResponse.json({ error: 'referral_id is required' }, { status: 400 })
  }

  if (!status || !VALID_STATUSES.includes(status as ReferralStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: updated, error: updateError } = await admin
    .from('attorney_referrals')
    .update({
      status,
      notes: notes ?? null,
      status_updated_at: new Date().toISOString(),
      status_updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', referral_id)
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('referrals/admin PATCH: update error', updateError)
    return NextResponse.json({ error: 'Failed to update referral' }, { status: 500 })
  }

  if (!updated) {
    return NextResponse.json({ error: 'Referral not found' }, { status: 404 })
  }

  fireReferralStatusUpdateNotification(referral_id, status, user.id)

  return NextResponse.json({ success: true })
}
