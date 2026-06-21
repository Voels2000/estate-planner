import type { SupabaseClient } from '@supabase/supabase-js'
import { resend } from '@/lib/resend'
import {
  BETA_SIGNUP_ACCESS_LABEL_PARAM,
  BETA_SIGNUP_ACCESS_PARAM,
} from '@/lib/waitlist-mode'
import { EMAIL_FROM } from '@/lib/email/config'
import { appendAdminUserActionLog, getAdminActorEmail } from '@/lib/admin/adminActionLog'

function buildInviteUrl(label?: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://mywealthmaps.com').replace(/\/$/, '')
  const token = process.env.BETA_SIGNUP_TOKEN?.trim()
  if (!token) {
    throw new Error('BETA_SIGNUP_TOKEN is not configured')
  }
  const params = new URLSearchParams({ [BETA_SIGNUP_ACCESS_PARAM]: token })
  if (label?.trim()) {
    params.set(BETA_SIGNUP_ACCESS_LABEL_PARAM, label.trim())
  }
  return `${base}/signup?${params.toString()}`
}

export async function sendWaitlistInvite(
  admin: SupabaseClient,
  options: {
    email: string
    label?: string
    adminUserId: string
  },
): Promise<void> {
  const normalizedEmail = options.email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    throw new Error('Valid email required')
  }

  const inviteUrl = buildInviteUrl(options.label)
  const now = new Date().toISOString()

  const { data: existing } = await admin
    .from('email_captures')
    .select('id, email, source')
    .eq('email', normalizedEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const { error: updateErr } = await admin
      .from('email_captures')
      .update({ invited_at: now, invite_label: options.label?.trim() || null })
      .eq('id', existing.id)
    if (updateErr) throw new Error(updateErr.message)
  } else {
    const { error: insertErr } = await admin.from('email_captures').insert({
      email: normalizedEmail,
      source: 'waitlist',
      invited_at: now,
      invite_label: options.label?.trim() || null,
      captured_at: now,
    })
    if (insertErr) throw new Error(insertErr.message)
  }

  const { error: emailErr } = await resend.emails.send({
    from: EMAIL_FROM,
    to: normalizedEmail,
    subject: 'Your invitation to My Wealth Maps',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:22px">You're invited</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6">
          Your spot on the My Wealth Maps waitlist is ready. Use the link below to create your account
          and start mapping your wealth.
        </p>
        <p style="margin-top:24px">
          <a href="${inviteUrl}" style="background:#0f1f3d;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block">
            Accept invitation
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin-top:24px">
          This link is personal to you. If you did not request access, you can ignore this email.
        </p>
      </div>
    `,
  })

  if (emailErr) throw new Error(emailErr.message)

  const adminEmail = await getAdminActorEmail(admin, options.adminUserId)
  await appendAdminUserActionLog(admin, {
    action: 'waitlist_invite',
    email: normalizedEmail,
    label: options.label?.trim() || null,
    adminEmail,
    adminUserId: options.adminUserId,
  })
}
