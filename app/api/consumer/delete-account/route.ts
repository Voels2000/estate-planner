import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleUserAccountDeletion } from '@/lib/compliance/scheduleUserAccountDeletion'
import { createStripeClient } from '@/lib/stripe/config'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = user.email
  if (!email) {
    return NextResponse.json({ error: 'Account email required' }, { status: 400 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'role, subscription_status, subscription_period_end, stripe_customer_id, firm_role',
    )
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)
  const admin = createAdminClient()

  try {
    const result = await scheduleUserAccountDeletion({
      admin,
      stripe,
      userId: user.id,
      email,
      profile,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, reason: result.reason },
        { status: 409 },
      )
    }

    return NextResponse.json({
      scheduled: result.scheduled,
      deletes_at: result.deletes_at,
      already_scheduled: result.already_scheduled,
    })
  } catch (err) {
    console.error(
      '[delete-account]',
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
