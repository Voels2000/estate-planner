import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') ?? 'schedule'

  if (view === 'audit') {
    const { data, error } = await admin
      .from('deletion_audit_log')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  }

  const { data, error } = await admin
    .from('deletion_schedule')
    .select('*')
    .order('scheduled_for', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
