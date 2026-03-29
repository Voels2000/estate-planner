const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

export type NotificationEmailPayload = {
  to: string
  type: string
  title: string
  body: string
  metadata?: Record<string, unknown>
}

function baseTemplate(title: string, body: string, ctaText?: string, ctaUrl?: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border-radius:12px;overflow:hidden;
                        box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <!-- Header -->
            <tr>
              <td style="background:#0f172a;padding:24px 32px;">
                <a href="${BASE_URL}" style="color:#ffffff;font-size:18px;
                   font-weight:600;text-decoration:none;">
                  WealthMaps
                </a>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#0f172a;">
                  ${title}
                </h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                  ${body}
                </p>
                ${ctaText && ctaUrl ? `
                <a href="${ctaUrl}"
                   style="display:inline-block;background:#0f172a;color:#ffffff;
                          padding:12px 24px;border-radius:8px;font-size:14px;
                          font-weight:500;text-decoration:none;">
                  ${ctaText}
                </a>` : ''}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                  You're receiving this from
                  <a href="${BASE_URL}" style="color:#64748b;">mywealthmaps.com</a>.
                  Questions? Reply to this email or contact support.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
}

export function buildNotificationEmail(payload: NotificationEmailPayload): {
  subject: string
  html: string
} {
  const { type, title, body, metadata } = payload

  switch (type) {
    case 'stale_plan':
      return {
        subject: 'Your estate plan needs attention',
        html: baseTemplate(
          title,
          body,
          'Review My Plan',
          `${BASE_URL}/dashboard`
        ),
      }

    case 'estate_milestone':
      return {
        subject: `Milestone reached: ${metadata?.milestone_label ?? 'Estate value update'}`,
        html: baseTemplate(
          title,
          body,
          'View My Estate Plan',
          `${BASE_URL}/estate-tax`
        ),
      }

    case 'advisor_viewed':
      return {
        subject: 'Your advisor viewed your profile',
        html: baseTemplate(
          title,
          body,
          'View Activity',
          `${BASE_URL}/my-advisor`
        ),
      }

    case 'subscription_renewal':
      return {
        subject: 'Your WealthMaps subscription renews soon',
        html: baseTemplate(
          title,
          body,
          'Manage Billing',
          `${BASE_URL}/billing`
        ),
      }

    case 'client_accepted_invite':
      return {
        subject: 'A client accepted your invitation',
        html: baseTemplate(
          title,
          body,
          'View Client',
          `${BASE_URL}/advisor`
        ),
      }

    case 'referral_status_update':
      return {
        subject: 'Your attorney referral has been updated',
        html: baseTemplate(
          title,
          body,
          'View Referral',
          `${BASE_URL}/referrals`
        ),
      }

    case 'mfa_reminder':
      return {
        subject: 'Secure your WealthMaps account',
        html: baseTemplate(
          title,
          body,
          'Enable Two-Factor Authentication',
          `${BASE_URL}/settings/security`
        ),
      }

    case 'plan_completion_nudge':
      return {
        subject: 'Complete your estate plan',
        html: baseTemplate(
          title,
          body,
          'Continue My Plan',
          `${BASE_URL}/profile`
        ),
      }

    default:
      return {
        subject: title,
        html: baseTemplate(title, body),
      }
  }
}
