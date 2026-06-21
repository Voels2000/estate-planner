import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { appendAdminUserActionLog, getAdminActorEmail } from '@/lib/admin/adminActionLog'
import { resend } from '@/lib/resend'
import { EMAIL_FROM } from '@/lib/email/config'

type RouteContext = { params: Promise<{ userId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const { userId } = await context.params
  const admin = createAdminClient()

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle()

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  if (!profile?.email) {
    return NextResponse.json({ error: 'User not found or has no email' }, { status: 404 })
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkErr?.message ?? 'Failed to generate reset link' },
      { status: 500 },
    )
  }

  const resetLink = linkData.properties.action_link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mywealthmaps.com'

  const { error: emailErr } = await resend.emails.send({
    from: EMAIL_FROM,
    to: profile.email,
    subject: 'Reset your My Wealth Maps password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:20px">Password reset</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6">
          We received a request to reset the password for your My Wealth Maps account.
          Click the button below to choose a new password.
        </p>
        <p style="margin-top:24px">
          <a href="${resetLink}" style="background:#0f1f3d;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block">
            Reset password
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin-top:24px">
          If you did not request this, you can ignore this email. You can also sign in at
          <a href="${appUrl}/login" style="color:#2563eb">${appUrl}/login</a>.
        </p>
      </div>
    `,
  })

  if (emailErr) {
    return NextResponse.json({ error: emailErr.message }, { status: 500 })
  }

  const adminEmail = await getAdminActorEmail(admin, auth.userId)
  await appendAdminUserActionLog(admin, {
    action: 'password_reset',
    userId,
    userEmail: profile.email,
    adminEmail,
    adminUserId: auth.userId,
  })

  return NextResponse.json({ sent: true, email: profile.email })
}
