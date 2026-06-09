import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'

export type WaitlistRow = {
  id: string
  email: string
  source: string
  score: number | null
  created_at: string
  drip_step_1_sent_at: string | null
  invited_at: string | null
  invite_label: string | null
  converted: boolean
}

function isWaitlistSource(source: string): boolean {
  return source === 'waitlist' || source.startsWith('waitlist')
}

export async function GET() {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()

  const { data: captures, error: capErr } = await admin
    .from('email_captures')
    .select(
      'id, email, source, score, created_at, drip_step_1_sent_at, invited_at, invite_label',
    )

  if (capErr) {
    return NextResponse.json({ error: capErr.message }, { status: 500 })
  }

  const emails = [...new Set((captures ?? []).map((c) => c.email.toLowerCase()))]
  const convertedEmails = new Set<string>()

  if (emails.length > 0) {
    const { data: profiles, error: profErr } = await admin
      .from('profiles')
      .select('email')
      .in('email', emails)

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    for (const p of profiles ?? []) {
      if (p.email) convertedEmails.add(p.email.toLowerCase())
    }
  }

  const rows: WaitlistRow[] = (captures ?? [])
    .map((c) => ({
      ...c,
      converted: convertedEmails.has(c.email.toLowerCase()),
    }))
    .filter((c) => isWaitlistSource(c.source) || !c.converted)
    .sort((a, b) => {
      const aInv = a.invited_at ? new Date(a.invited_at).getTime() : 0
      const bInv = b.invited_at ? new Date(b.invited_at).getTime() : 0
      if (aInv !== bInv) return bInv - aInv
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const summary = {
    waiting: rows.filter((r) => !r.invited_at && !r.converted).length,
    invited: rows.filter((r) => r.invited_at && !r.converted).length,
    converted: rows.filter((r) => r.converted).length,
  }

  return NextResponse.json({ data: { rows, summary } })
}
