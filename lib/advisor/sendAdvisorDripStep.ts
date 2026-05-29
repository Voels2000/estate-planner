import type { SupabaseClient } from '@supabase/supabase-js'
import { resend } from '@/lib/resend'
import { getAppUrl } from '@/lib/app-url'
import {
  ADVISOR_DRIP_SEQUENCE,
  buildAdvisorDripEmailHtml,
} from '@/lib/emails/advisor-drip-templates'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribeToken'

const DRIP_SENT_COLUMNS = {
  1: 'advisor_drip_step_1_sent_at',
  2: 'advisor_drip_step_2_sent_at',
  3: 'advisor_drip_step_3_sent_at',
} as const

export type AdvisorDripStep = 1 | 2 | 3

export async function sendAdvisorDripStep(
  admin: SupabaseClient,
  advisorId: string,
  sequenceStep: AdvisorDripStep,
): Promise<{ ok: boolean; skipped?: string }> {
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, email, full_name, role, advisor_drip_step_1_sent_at, advisor_drip_step_2_sent_at, advisor_drip_step_3_sent_at, advisor_drip_unsubscribed_at',
    )
    .eq('id', advisorId)
    .maybeSingle()

  if (!profile?.email) return { ok: false, skipped: 'no_email' }
  if (profile.role !== 'advisor' && profile.role !== 'financial_advisor') {
    return { ok: false, skipped: 'not_advisor' }
  }
  if (profile.advisor_drip_unsubscribed_at) return { ok: false, skipped: 'unsubscribed' }

  if (sequenceStep === 1 && profile.advisor_drip_step_1_sent_at) {
    return { ok: false, skipped: 'already_sent' }
  }
  if (sequenceStep === 2 && profile.advisor_drip_step_2_sent_at) {
    return { ok: false, skipped: 'already_sent' }
  }
  if (sequenceStep === 3 && profile.advisor_drip_step_3_sent_at) {
    return { ok: false, skipped: 'already_sent' }
  }

  if (sequenceStep === 2) {
    const { count } = await admin
      .from('advisor_clients')
      .select('id', { count: 'exact', head: true })
      .eq('advisor_id', advisorId)
      .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])

    if ((count ?? 0) > 0) {
      return { ok: false, skipped: 'has_clients' }
    }
  }

  const emailData =
    sequenceStep === 1
      ? ADVISOR_DRIP_SEQUENCE.email1
      : sequenceStep === 2
        ? ADVISOR_DRIP_SEQUENCE.email2
        : ADVISOR_DRIP_SEQUENCE.email3

  const normalizedEmail = profile.email.trim().toLowerCase()
  const appUrl = getAppUrl()
  const unsubscribeUrl = buildUnsubscribeUrl(appUrl, normalizedEmail, 'advisor')

  const html = buildAdvisorDripEmailHtml({
    email: emailData,
    recipientEmail: normalizedEmail,
    unsubscribeUrl,
  })

  const { error: sendError } = await resend.emails.send({
    from: 'MyWealthMaps <hello@mywealthmaps.com>',
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
    tags: [{ name: 'category', value: `advisor_drip_${sequenceStep}` }],
    to: normalizedEmail,
    subject: emailData.subject,
    html,
  })

  if (sendError) {
    console.error('advisor drip send error:', sendError)
    return { ok: false, skipped: 'send_failed' }
  }

  const sentColumn = DRIP_SENT_COLUMNS[sequenceStep]

  const { error: updateError } = await admin
    .from('profiles')
    .update({ [sentColumn]: new Date().toISOString() })
    .eq('id', advisorId)

  if (updateError) {
    console.error('advisor drip log error:', updateError.message)
  }

  return { ok: true }
}

/** Fire step 1 once when an advisor first activates (signup callback or portal visit). */
export async function ensureAdvisorActivationDripStep1(
  admin: SupabaseClient,
  advisorId: string,
): Promise<void> {
  await sendAdvisorDripStep(admin, advisorId, 1)
}
