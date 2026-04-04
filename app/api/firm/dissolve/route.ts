import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST() {
  try {
    const ctx = await getAccessContext()
    if (!ctx.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ctx.isAdvisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!ctx.isFirmOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!ctx.firm_id) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: firm, error: firmFetchError } = await admin
      .from('firms')
      .select('id, stripe_subscription_id, subscription_status')
      .eq('id', ctx.firm_id)
      .maybeSingle()

    if (firmFetchError) {
      console.error('firm dissolve: fetch firm', firmFetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    if (!firm) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (firm.stripe_subscription_id && firm.subscription_status !== 'canceled') {
      try {
        await stripe.subscriptions.cancel(firm.stripe_subscription_id)
      } catch (stripeErr) {
        console.error('firm dissolve: stripe cancel', stripeErr)
      }
    }

    const { data: memberRows, error: membersFetchError } = await admin
      .from('firm_members')
      .select('id, user_id')
      .eq('firm_id', ctx.firm_id)
      .eq('firm_role', 'member')
      .neq('status', 'removed')

    if (membersFetchError) {
      console.error('firm dissolve: fetch member rows', membersFetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    for (const row of memberRows ?? []) {
      if (row.user_id) {
        const { error: memberProfileError } = await admin
          .from('profiles')
          .update({ firm_id: null, firm_role: null })
          .eq('id', row.user_id)

        if (memberProfileError) {
          console.error('firm dissolve: clear member profile', memberProfileError)
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
      }
    }

    const { error: membersRemoveError } = await admin
      .from('firm_members')
      .update({
        status: 'removed',
        updated_at: new Date().toISOString(),
      })
      .eq('firm_id', ctx.firm_id)
      .eq('firm_role', 'member')
      .neq('status', 'removed')

    if (membersRemoveError) {
      console.error('firm dissolve: update member firm_members', membersRemoveError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: ownerProfileError } = await admin
      .from('profiles')
      .update({ firm_id: null, firm_role: null })
      .eq('id', ctx.user.id)

    if (ownerProfileError) {
      console.error('firm dissolve: clear owner profile', ownerProfileError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: firmSoftDeleteError } = await admin
      .from('firms')
      .update({
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.firm_id)

    if (firmSoftDeleteError) {
      console.error('firm dissolve: soft-delete firm', firmSoftDeleteError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: ownerMemberError } = await admin
      .from('firm_members')
      .update({
        status: 'removed',
        updated_at: new Date().toISOString(),
      })
      .eq('firm_id', ctx.firm_id)
      .eq('firm_role', 'owner')

    if (ownerMemberError) {
      console.error('firm dissolve: remove owner firm_members', ownerMemberError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/firm/dissolve', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
