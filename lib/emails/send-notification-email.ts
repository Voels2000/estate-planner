import { resend } from '@/lib/resend'
import {
  buildNotificationEmail,
  type NotificationEmailPayload,
} from '@/lib/notification-email'
import { EMAIL_FROM, EMAIL_REPLY_TO } from '@/lib/email/config'

export async function sendNotificationEmail(
  payload: NotificationEmailPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subject, html } = buildNotificationEmail(payload)
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    replyTo: EMAIL_REPLY_TO,
    to: payload.to,
    subject,
    html,
  })
  if (error) {
    console.error('[sendNotificationEmail]', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
