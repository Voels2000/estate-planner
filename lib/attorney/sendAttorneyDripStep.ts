import type { SupabaseClient } from '@supabase/supabase-js'
import { resend } from '@/lib/resend'
import { getAppUrl } from '@/lib/app-url'
import {
  getAttorneyDripSequence,
  buildAttorneyDripEmailHtml,
} from '@/lib/emails/attorney-drip-templates'
import { EMAIL_FROM } from '@/lib/email/config'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribeToken'

const DRIP_SENT_COLUMNS = {
  1: 'attorney_drip_step_1_sent_at',
  2: 'attorney_drip_step_2_sent_at',
  3: 'attorney_drip_step_3_sent_at',
} as const

export type AttorneyDripStep = 1 | 2 | 3

function isAttorneyProfile(profile: { role?: string | null; is_attorney?: boolean | null }): boolean {
  return profile.role === 'attorney' || profile.is_attorney === true
}

export async function sendAttorneyDripStep(
  admin: SupabaseClient,
  attorneyId: string,
  sequenceStep: AttorneyDripStep,
): Promise<{ ok: boolean; skipped?: string }> {
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, email, role, is_attorney, attorney_drip_step_1_sent_at, attorney_drip_step_2_sent_at, attorney_drip_step_3_sent_at',
    )
    .eq('id', attorneyId)
    .maybeSingle()

  if (!profile?.email) return { ok: false, skipped: 'no_email' }
  if (!isAttorneyProfile(profile)) return { ok: false, skipped: 'not_attorney' }

  if (sequenceStep === 1 && profile.attorney_drip_step_1_sent_at) {
    return { ok: false, skipped: 'already_sent' }
  }
  if (sequenceStep === 2 && profile.attorney_drip_step_2_sent_at) {
    return { ok: false, skipped: 'already_sent' }
  }
  if (sequenceStep === 3 && profile.attorney_drip_step_3_sent_at) {
    return { ok: false, skipped: 'already_sent' }
  }

  const sequence = getAttorneyDripSequence()
  const emailData =
    sequenceStep === 1
      ? sequence.email1
      : sequenceStep === 2
        ? sequence.email2
        : sequence.email3

  const normalizedEmail = profile.email.trim().toLowerCase()
  const appUrl = getAppUrl()
  const unsubscribeUrl = buildUnsubscribeUrl(appUrl, normalizedEmail, 'attorney')

  const html = buildAttorneyDripEmailHtml({
    email: emailData,
    unsubscribeUrl,
  })

  const { error: sendError } = await resend.emails.send({
    from: EMAIL_FROM,
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
    tags: [{ name: 'category', value: `attorney_drip_${sequenceStep}` }],
    to: normalizedEmail,
    bcc: 'avoels@comcast.net',
    subject: emailData.subject,
    html,
  })

  if (sendError) {
    console.error('attorney drip send error:', sendError)
    return { ok: false, skipped: 'send_failed' }
  }

  const sentColumn = DRIP_SENT_COLUMNS[sequenceStep]
  const { error: updateError } = await admin
    .from('profiles')
    .update({ [sentColumn]: new Date().toISOString() })
    .eq('id', attorneyId)

  if (updateError) {
    console.error('attorney drip log error:', updateError.message)
  }

  return { ok: true }
}

/** Fire step 1 once when an attorney first activates (claim listing or portal visit). */
export async function ensureAttorneyActivationDripStep1(
  admin: SupabaseClient,
  attorneyId: string,
): Promise<void> {
  await sendAttorneyDripStep(admin, attorneyId, 1)
}

/** Send by email address — used by cron for steps 2/3. */
export async function sendAttorneyDripStepByEmail(
  admin: SupabaseClient,
  email: string,
  sequenceStep: AttorneyDripStep,
): Promise<{ ok: boolean; skipped?: string }> {
  const normalizedEmail = email.trim().toLowerCase()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (!profile?.id) return { ok: false, skipped: 'profile_not_found' }
  return sendAttorneyDripStep(admin, profile.id, sequenceStep)
}
