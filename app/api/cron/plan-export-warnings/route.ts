import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCronHealth } from '@/lib/cron/recordCronHealth'
import { requireCronAuth } from '@/lib/api/internalApiAuth'
import { processPlanExportWarnings } from '@/lib/billing/planExportWarnings'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const admin = createAdminClient()
    const result = await processPlanExportWarnings(admin)

    await recordCronHealth(
      'plan-export-warnings',
      'ok',
      `scanned=${result.scanned} sent14d=${result.sent14d} sent3d=${result.sent3d} errors=${result.errors}`,
    )

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'plan-export-warnings failed'
    console.error('[cron/plan-export-warnings]', message)
    await recordCronHealth('plan-export-warnings', 'error', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
