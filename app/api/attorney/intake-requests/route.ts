import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { ATTORNEY_UNIVERSAL_INTAKE_MONTHLY_CAP } from '@/lib/attorney/attorneyTierLimits'

function isAttorneyProfile(profile: { role?: string | null; is_attorney?: boolean | null }) {
  return profile.role === 'attorney' || profile.is_attorney === true
}

function resolveDisplayStatus(
  row: { status: string; expires_at: string },
): 'sent' | 'opened' | 'completed' | 'expired' {
  if (row.status === 'completed') return 'completed'
  if (row.status === 'expired') return 'expired'
  if (new Date(row.expires_at) < new Date()) return 'expired'
  if (row.status === 'opened') return 'opened'
  return 'sent'
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, attorney_tier, is_attorney')
    .eq('id', user.id)
    .single()

  if (!isAttorneyProfile(profile ?? {})) {
    return NextResponse.json({ error: 'Attorney role required' }, { status: 403 })
  }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [{ data: requests }, { count: sentThisMonth }] = await Promise.all([
    supabase
      .from('attorney_intake_requests')
      .select('id, client_email, client_name, status, sent_at, opened_at, completed_at, expires_at')
      .eq('attorney_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(20),
    supabase
      .from('attorney_intake_requests')
      .select('*', { count: 'exact', head: true })
      .eq('attorney_id', user.id)
      .gte('created_at', startOfMonth.toISOString()),
  ])

  const rows = (requests ?? []).map((r) => ({
    ...r,
    displayStatus: resolveDisplayStatus(r),
  }))

  return NextResponse.json({
    requests: rows,
    sentThisMonth: sentThisMonth ?? 0,
    monthlyCap: isConnectionBillingEnabled()
      ? ATTORNEY_UNIVERSAL_INTAKE_MONTHLY_CAP
      : (profile?.attorney_tier ?? 0) === 0
        ? ATTORNEY_UNIVERSAL_INTAKE_MONTHLY_CAP
        : null,
  })
}
