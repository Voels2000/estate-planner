import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const { userId } = await context.params
  const admin = createAdminClient()

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select(
      'id, email, full_name, role, consumer_tier, attorney_tier, subscription_status, subscription_plan, subscription_period_end, stripe_customer_id, created_at, terms_accepted_at, terms_version',
    )
    .eq('id', userId)
    .maybeSingle()

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      ...profile,
      last_sign_in_at: authData.user?.last_sign_in_at ?? null,
    },
  })
}
