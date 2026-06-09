import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { appendAdminUserActionLog, getAdminActorEmail } from '@/lib/admin/adminActionLog'

type RouteContext = { params: Promise<{ userId: string }> }

const VALID_TIERS = new Set([1, 2, 3])

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const { userId } = await context.params

  let body: { consumer_tier?: number; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tier = body.consumer_tier
  const reason = body.reason?.trim()

  if (!VALID_TIERS.has(tier as number)) {
    return NextResponse.json({ error: 'consumer_tier must be 1, 2, or 3' }, { status: 400 })
  }

  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile, error: fetchErr } = await admin
    .from('profiles')
    .select('id, consumer_tier, email')
    .eq('id', userId)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const oldTier = profile.consumer_tier ?? 1

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ consumer_tier: tier })
    .eq('id', userId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const adminEmail = await getAdminActorEmail(admin, auth.userId)
  await appendAdminUserActionLog(admin, {
    action: 'tier_override',
    userId,
    userEmail: profile.email,
    oldTier,
    newTier: tier,
    reason,
    adminEmail,
    adminUserId: auth.userId,
  })

  return NextResponse.json({
    data: { consumer_tier: tier, oldTier },
  })
}
