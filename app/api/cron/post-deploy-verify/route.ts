import { NextRequest, NextResponse } from 'next/server'
import { runPostDeployVoelsChecks } from '@/lib/verify/runPostDeployVoelsChecks'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Daily post-deploy verification — Voels MC Phase 3 + PDF narrative gate.
 * Self-heals missing Voels MC cache, then verifies. Auth: Bearer CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.mywealthmaps.com')

  const checks = await runPostDeployVoelsChecks({ baseUrl, remediate: true })
  const failed = checks.filter((c) => !c.pass)

  if (failed.length > 0) {
    console.error('[cron/post-deploy-verify] FAILED:', failed)
    return NextResponse.json(
      {
        ok: false,
        passed: checks.length - failed.length,
        failed: failed.length,
        checks,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    passed: checks.length,
    checks,
  })
}
