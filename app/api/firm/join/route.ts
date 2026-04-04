import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function POST(request: Request) {
  try {
    const ctx = await getAccessContext()
    if (!ctx.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ctx.isAdvisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const invite_token =
      typeof body.invite_token === 'string' ? body.invite_token.trim() : ''
    const firm_id = typeof body.firm_id === 'string' ? body.firm_id.trim() : ''
    if (!invite_token || !firm_id) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: row, error: lookupError } = await admin
      .from('firm_members')
      .select('id, firm_id, invited_email, status, user_id')
      .eq('invite_token', invite_token)
      .eq('firm_id', firm_id)
      .maybeSingle()

    if (lookupError) {
      console.error('firm join lookup:', lookupError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (row.status !== 'pending') {
      return NextResponse.json({ error: 'Conflict' }, { status: 409 })
    }

    const userEmail = ctx.user.email
    const invited = row.invited_email
    if (
      !invited ||
      normalizeEmail(userEmail) !== normalizeEmail(invited)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()

    const { error: memberError } = await admin
      .from('firm_members')
      .update({
        status: 'active',
        user_id: ctx.user.id,
        joined_at: now,
      })
      .eq('id', row.id)

    if (memberError) {
      console.error('firm join member update:', memberError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ firm_id, firm_role: 'member' })
      .eq('id', ctx.user.id)

    if (profileError) {
      console.error('firm join profile update:', profileError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/firm/join', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
