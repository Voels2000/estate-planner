import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { sendPrivacyRequestConfirmationEmail } from '@/lib/email/privacyRequestConfirmationEmail'

const VALID_REQUEST_TYPES = new Set([
  'deletion',
  'access',
  'correction',
  'portability',
  'opt_out',
])

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const requestType =
    typeof body.request_type === 'string' ? body.request_type.trim() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (!VALID_REQUEST_TYPES.has(requestType)) {
    return NextResponse.json({ error: 'Invalid request_type' }, { status: 400 })
  }

  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, 2000)
      : null

  let receivedAt = new Date()
  if (typeof body.received_at === 'string') {
    const parsed = new Date(body.received_at)
    if (!Number.isNaN(parsed.getTime())) receivedAt = parsed
  }

  const dueAt = new Date(receivedAt)
  dueAt.setDate(dueAt.getDate() + 45)

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  const notes = description
    ? `[admin_intake] ${description}`
    : '[admin_intake] Email-only request'

  const { data, error } = await admin
    .from('privacy_requests')
    .insert({
      user_id: profile?.id ?? null,
      email,
      request_type: requestType,
      notes,
      received_at: receivedAt.toISOString(),
      due_at: dueAt.toISOString(),
      status: 'pending',
    })
    .select('id, due_at')
    .single()

  if (error) {
    console.error('[admin/privacy-requests]', error.message)
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
      '[admin/privacy-requests] confirmation email failed:',
      emailErr instanceof Error ? emailErr.message : emailErr,
    )
  }

  return NextResponse.json({ id: data.id, due_at: data.due_at }, { status: 201 })
}
