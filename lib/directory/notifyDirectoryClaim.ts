import { resend } from '@/lib/resend'
import { EMAIL_FROM } from '@/lib/email/config'

export async function notifyDirectoryClaim(params: {
  type: 'attorney' | 'advisor'
  firmName: string
  contactName: string | null
  userEmail: string
  barNumber?: string | null
  crdNumber?: string | null
  listingId: string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const adminPath =
    params.type === 'attorney' ? '/admin/attorney-directory' : '/admin/advisor-directory'
  const credential =
    params.type === 'attorney'
      ? `Bar #: ${params.barNumber ?? '— (not supplied)'}`
      : `CRD #: ${params.crdNumber ?? '— (not supplied)'}`

  await resend.emails.send({
    from: EMAIL_FROM,
    to: 'avoels@comcast.net',
    subject: `Directory listing claimed — ${params.firmName}`,
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
    tags: [{ name: 'category', value: 'directory_claim' }],
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:24px">My Wealth Maps</h1>
        <p style="color:#6b7280;font-size:14px">Directory claim notification</p>
        <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
          <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">${params.type === 'attorney' ? 'Attorney' : 'Advisor'} listing claimed</h2>
          <p><strong>Firm:</strong> ${params.firmName}</p>
          <p><strong>Contact:</strong> ${params.contactName ?? '—'}</p>
          <p><strong>Claimed by:</strong> ${params.userEmail}</p>
          <p><strong>${credential}</strong></p>
          <p style="margin-top:24px">Confirm credential → set <code>credential_verified_at</code> in admin.</p>
          <a href="${appUrl}${adminPath}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px">
            Open admin →
          </a>
        </div>
      </div>
    `,
  })
}
