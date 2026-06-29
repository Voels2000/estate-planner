import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { runPostDeployVoelsChecks } from '@/lib/verify/runPostDeployVoelsChecks'
import { runProdBackupHealthCheck } from '@/lib/verify/supabaseBackupHealth'
import { recordCronHealth } from '@/lib/cron/recordCronHealth'
import { requireCronAuth } from '@/lib/api/internalApiAuth'
import { sendPostDeployFailureEmail } from '@/lib/email/postDeployFailureEmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Daily post-deploy verification — Voels MC Phase 3 + PDF narrative gate.
 * Self-heals missing Voels MC cache, then verifies. Auth: Bearer CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.mywealthmaps.com')

  try {
    const checks = await runPostDeployVoelsChecks({ baseUrl, remediate: true })
    const backupCheck = await runProdBackupHealthCheck()
    if (backupCheck) checks.push(backupCheck)

    const failed = checks.filter((c) => !c.pass)

    if (failed.length > 0) {
      const failureSummary = failed
        .map((c) => `${c.id}: ${c.detail ?? 'failed'}`)
        .join('; ')
      console.error('[cron/post-deploy-verify] FAILED:', failed)
      Sentry.captureMessage('post-deploy-verify failed', {
        level: 'error',
        tags: { area: 'post_deploy_verify' },
        extra: { failed: failed.map((c) => ({ id: c.id, detail: c.detail })) },
      })
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
