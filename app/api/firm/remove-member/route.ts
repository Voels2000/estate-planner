import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { syncFirmStripeQuantity } from '@/lib/stripe/syncFirmQuantity'

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}))
    const memberId = typeof body.memberId === 'string' ? body.memberId : ''
    if (!memberId.trim()) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: row, error: fetchError } = await supabase
      .from('firm_members')
      .select('id, user_id, firm_role, status')
      .eq('id', memberId)
      .eq('firm_id', ctx.firm_id)
      .maybeSingle()

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (row.firm_role === 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (row.status === 'removed') {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { error: updateMemberError } = await admin
      .from('firm_members')
      .update({
        status: 'removed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)

    if (updateMemberError) {
      console.error('firm remove-member update:', updateMemberError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (row.user_id) {
      const { error: profileError } = await admin
        .from('profiles')
        .update({ firm_id: null, firm_role: null })
        .eq('id', row.user_id)

      if (profileError) {
        console.error('firm remove-member profile:', profileError)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    }

    const { data: firmRow } = await admin
      .from('firms')
      .select('seat_count')
      .eq('id', ctx.firm_id)
      .single()

    const nextSeats = Math.max((firmRow?.seat_count ?? 1) - 1, 1)
    const { error: seatError } = await admin
      .from('firms')
      .update({ seat_count: nextSeats })
      .eq('id', ctx.firm_id)

    if (seatError) {
      console.error('firm remove-member seat_count:', seatError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    await syncFirmStripeQuantity(ctx.firm_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/firm/remove-member', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
