import { generateClaimMagicLink, type ClaimRole } from '@/lib/auth/generateClaimMagicLink'
import { EMAIL_FROM, EMAIL_REPLY_TO } from '@/lib/email/config'
import {
  buildAttorneyDirectoryOutreachEmail,
  buildAdvisorDirectoryOutreachEmail,
} from '@/lib/emails/directory-outreach-templates'
import { Resend } from 'resend'

export type SendDirectoryOutreachEmailArgs = {
  role: ClaimRole
  email: string
  claimToken: string
  firmName: string
  firstName: string
  senderName: string
}

export type SendDirectoryOutreachResult = {
  ok: boolean
  claimLink: string
  resendId?: string
  error?: string
}

function outreachFromAddress(): string {
  return process.env.DIRECTORY_OUTREACH_FROM_ADDRESS?.trim() || EMAIL_FROM
}

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    throw new Error('RESEND_API_KEY is required to send directory outreach email')
  }
  return new Resend(key)
}

/** Generate claim magic link + send outreach mail. Does not update outreach_sent_at — caller owns dedup. */
export async function sendDirectoryOutreachEmail(
  args: SendDirectoryOutreachEmailArgs,
): Promise<SendDirectoryOutreachResult> {
  const { role, email, claimToken, firmName, firstName, senderName } = args

  let claimLink: string
  try {
    claimLink = await generateClaimMagicLink({ email, claimToken, role })
  } catch (err) {
    return {
      ok: false,
      claimLink: '',
      error: err instanceof Error ? err.message : 'generateClaimMagicLink failed',
    }
  }

  const built =
    role === 'attorney'
      ? buildAttorneyDirectoryOutreachEmail({ firmName, firstName, claimLink, senderName })
      : buildAdvisorDirectoryOutreachEmail({ firmName, firstName, claimLink, senderName })

  try {
    const resend = getResendClient()
    const { data, error } = await resend.emails.send({
      from: outreachFromAddress(),
      replyTo: EMAIL_REPLY_TO,
      to: email,
      subject: built.subject,
      html: built.bodyHtml,
      text: built.bodyText,
    })

    if (error) {
      return { ok: false, claimLink, error: error.message }
    }

    return { ok: true, claimLink, resendId: data?.id }
  } catch (err) {
    return {
      ok: false,
      claimLink,
      error: err instanceof Error ? err.message : 'unknown send error',
    }
  }
}
