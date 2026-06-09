import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { sendWaitlistInvite } from '@/lib/admin/waitlistInvite'

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  let body: { email?: string; label?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.email?.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    await sendWaitlistInvite(admin, {
      email: body.email,
      label: body.label,
      adminUserId: auth.userId,
    })
    return NextResponse.json({ sent: true, email: body.email.trim().toLowerCase() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invite failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
