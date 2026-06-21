import type { SupabaseClient } from '@supabase/supabase-js'
import { resend } from '@/lib/resend'
import {
  buildAttorneyDigestEmail,
  buildAttorneyDigestEmailHtml,
} from '@/lib/emails/attorney-digest-template'
import { EMAIL_FROM } from '@/lib/email/config'
import {
  attorneyDigestHasActionableItems,
  getAttorneyDigestData,
} from '@/lib/attorney/getAttorneyDigestData'

function isAttorneyProfile(profile: { role?: string | null; is_attorney?: boolean | null }): boolean {
  return profile.role === 'attorney' || profile.is_attorney === true
}

export async function sendAttorneyDigest(
  admin: SupabaseClient,
  attorneyUserId: string,
): Promise<{ ok: boolean; skipped?: string }> {
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, role, is_attorney, attorney_digest_sent_at')
    .eq('id', attorneyUserId)
    .maybeSingle()

  if (!profile?.email) return { ok: false, skipped: 'no_email' }
  if (!isAttorneyProfile(profile)) return { ok: false, skipped: 'not_attorney' }

  const digestData = await getAttorneyDigestData(admin, attorneyUserId)
  if (!digestData) return { ok: false, skipped: 'no_clients' }
  if (!attorneyDigestHasActionableItems(digestData)) {
    return { ok: false, skipped: 'nothing_to_report' }
  }

  const emailData = buildAttorneyDigestEmail(digestData)
  const html = buildAttorneyDigestEmailHtml({ email: emailData })
  const normalizedEmail = profile.email.trim().toLowerCase()

  const { error: sendError } = await resend.emails.send({
    from: EMAIL_FROM,
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
    tags: [{ name: 'category', value: 'attorney_digest_weekly' }],
    to: normalizedEmail,
    bcc: 'avoels@comcast.net',
    subject: emailData.subject,
    html,
  })

  if (sendError) {
    console.error('attorney digest send error:', sendError)
    return { ok: false, skipped: 'send_failed' }
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ attorney_digest_sent_at: new Date().toISOString() })
    .eq('id', attorneyUserId)

  if (updateError) {
    console.error('attorney digest log error:', updateError.message)
  }

  return { ok: true }
}
