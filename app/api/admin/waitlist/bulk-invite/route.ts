import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { sendWaitlistInvite } from '@/lib/admin/waitlistInvite'

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  let body: { emails?: string[]; label?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const emails = (body.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'))

  if (emails.length === 0) {
    return NextResponse.json({ error: 'emails array is required' }, { status: 400 })
  }

  if (!body.label?.trim()) {
    return NextResponse.json({ error: 'label is required for bulk invite' }, { status: 400 })
  }

  const admin = createAdminClient()
  const sent: string[] = []
  const failed: Array<{ email: string; error: string }> = []

  for (const email of emails) {
    try {
      await sendWaitlistInvite(admin, {
        email,
        label: body.label,
        adminUserId: auth.userId,
      })
      sent.push(email)
    } catch (err) {
      failed.push({
        email,
        error: err instanceof Error ? err.message : 'Invite failed',
      })
    }
  }

  return NextResponse.json({ sent, failed })
}
