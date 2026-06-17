import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { recordCronHealth, type CronHealthStatus } from '@/lib/cron/recordCronHealth'
import { requireCronOrInternal } from '@/lib/api/internalApiAuth'

export async function GET() {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const { data, error } = await admin.from('cron_health').select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: data ?? [] })
}

export async function POST(request: NextRequest) {
  const cronDenied = requireCronOrInternal(request)
  if (cronDenied !== null) {
    const auth = await requireAdminApi()
    if (auth instanceof NextResponse) return auth
  }

  const body = await request.json().catch(() => ({}))
  const jobName = typeof body.job_name === 'string' ? body.job_name.trim() : ''
  const status = body.status as CronHealthStatus

  if (!jobName) {
    return NextResponse.json({ error: 'job_name required' }, { status: 400 })
  }
  if (!['ok', 'warning', 'error'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const message =
    typeof body.message === 'string' ? body.message.slice(0, 2000) : undefined

  await recordCronHealth(jobName, status, message)

  return NextResponse.json({ ok: true })
}
