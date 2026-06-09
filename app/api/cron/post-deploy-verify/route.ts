import { NextRequest, NextResponse } from 'next/server'
import { runPostDeployVoelsChecks } from '@/lib/verify/runPostDeployVoelsChecks'
import { recordCronHealth } from '@/lib/cron/recordCronHealth'
import { sendPostDeployFailureEmail } from '@/lib/email/postDeployFailureEmail'

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

  try {
    const checks = await runPostDeployVoelsChecks({ baseUrl, remediate: true })
    const failed = checks.filter((c) => !c.pass)

    if (failed.length > 0) {
      const failureSummary = failed
        .map((c) => `${c.id}: ${c.detail ?? 'failed'}`)
        .join('; ')
      console.error('[cron/post-deploy-verify] FAILED:', failed)
      await recordCronHealth('post-deploy-verify', 'error', failureSummary)

      const complianceEmail = process.env.COMPLIANCE_EMAIL
      if (complianceEmail) {
        try {
          await sendPostDeployFailureEmail({
            to: complianceEmail,
            failedChecks: failed.map((c) => ({
              name: c.id,
              detail: c.detail,
            })),
          })
        } catch (emailErr) {
          console.error('[cron/post-deploy-verify] alert email failed:', emailErr)
        }
      }

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

    await recordCronHealth(
      'post-deploy-verify',
      'ok',
      `${checks.length} checks passed`,
    )

    return NextResponse.json({
      ok: true,
      passed: checks.length,
      checks,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'post-deploy-verify failed'
    console.error('[cron/post-deploy-verify]', message)
    await recordCronHealth('post-deploy-verify', 'error', message)

    const complianceEmail = process.env.COMPLIANCE_EMAIL
    if (complianceEmail) {
      try {
        await sendPostDeployFailureEmail({
          to: complianceEmail,
          failedChecks: [{ name: 'post-deploy-verify', detail: message }],
        })
      } catch (emailErr) {
        console.error('[cron/post-deploy-verify] alert email failed:', emailErr)
      }
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
