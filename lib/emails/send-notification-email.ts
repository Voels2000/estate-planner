import { resend } from '@/lib/resend'
import {
  buildNotificationEmail,
  type NotificationEmailPayload,
} from '@/lib/notification-email'

export async function sendNotificationEmail(
  payload: NotificationEmailPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subject, html } = buildNotificationEmail(payload)
  const { error } = await resend.emails.send({
    from: 'MyWealthMaps <hello@mywealthmaps.com>',
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
