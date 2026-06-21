import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPrivacyRequestConfirmationEmail } from '@/lib/email/privacyRequestConfirmationEmail'

const VALID_REQUEST_TYPES = new Set([
  'deletion',
  'access',
  'correction',
  'portability',
  'opt_out',
])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const requestType =
    typeof body.request_type === 'string' ? body.request_type.trim() : ''

  if (!VALID_REQUEST_TYPES.has(requestType)) {
    return NextResponse.json({ error: 'Invalid request_type' }, { status: 400 })
  }

  const email = user.email
  if (!email) {
    return NextResponse.json({ error: 'Account email required' }, { status: 400 })
  }

  const notes =
    typeof body.notes === 'string' && body.notes.trim()
      ? body.notes.trim().slice(0, 2000)
      : null

  // Service-role insert after auth — C7 omitted GRANTs; user-JWT insert failed RLS on prod.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('privacy_requests')
    .insert({
      user_id: user.id,
      email,
      request_type: requestType,
      notes,
    })
    .select('id, due_at')
    .single()

  if (error) {
    console.error('[privacy-request] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    await sendPrivacyRequestConfirmationEmail({
      to: email,
      requestType,
      requestId: data.id,
      dueAt: data.due_at,
    })
  } catch (emailErr) {
    console.error(
      '[privacy-request] confirmation email failed:',
      emailErr instanceof Error ? emailErr.message : emailErr,
    )
  }

  return NextResponse.json({ id: data.id, due_at: data.due_at }, { status: 201 })
}
