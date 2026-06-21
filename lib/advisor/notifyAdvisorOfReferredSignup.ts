import { createAdminClient } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { getAppUrl } from '@/lib/app-url'
import { EMAIL_FROM } from '@/lib/email/config'

export async function notifyAdvisorOfReferredSignup(params: {
  advisorId: string
  consumerName: string | null
  consumerEmail: string
}) {
  const admin = createAdminClient()

  const { data: advisor } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', params.advisorId)
    .single()

  if (!advisor?.email) return

  const baseUrl = getAppUrl()
  const displayName = params.consumerName?.trim() || params.consumerEmail

  try {
    await admin.rpc('create_notification', {
      p_user_id: params.advisorId,
      p_type: 'referral_signup',
      p_title: 'A new household connected through your referral',
      p_body: `${displayName} signed up via your referral link. Log in to invite them as a client.`,
      p_delivery: 'in_app',
      p_metadata: { consumer_email: params.consumerEmail },
      p_cooldown: '1 hour',
    })
  } catch (err) {
    console.error('referral_signup notification error:', err)
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: advisor.email,
    bcc: 'avoels@comcast.net',
    subject: 'New household connected through your referral',
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <p style="color:#C9A84C;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px">My Wealth Maps</p>
        <h2 style="color:#0F1B3C;font-size:22px;font-weight:400;margin:0 0 20px">
          A new household connected through your referral
        </h2>
        <p style="color:#374151;font-size:15px;line-height:1.7">
          <strong>${displayName}</strong> signed up via your referral link.
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.7">
          Log in to your advisor portal to invite them as a client.
        </p>
        <a href="${baseUrl}/advisor"
           style="display:inline-block;background:#C9A84C;color:#0F1B3C;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:700;margin-top:16px">
          Go to advisor portal →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px">
          You're receiving this because a consumer signed up using your My Wealth Maps referral link.
        </p>
      </div>
    `,
  }).catch((err) => {
    console.error('referral_signup email error:', err)
  })
}

export async function notifyAdvisorForReferralCode(params: {
  referralCode: string
  consumerName: string | null
  consumerEmail: string
}) {
  const admin = createAdminClient()
  const { data: listing } = await admin
    .from('advisor_directory')
    .select('profile_id')
    .eq('referral_code', params.referralCode)
    .maybeSingle()

  if (!listing?.profile_id) return

  void notifyAdvisorOfReferredSignup({
    advisorId: listing.profile_id,
    consumerName: params.consumerName,
    consumerEmail: params.consumerEmail,
  }).catch((err) => {
    console.error('notifyAdvisorForReferralCode error:', err)
  })
}
