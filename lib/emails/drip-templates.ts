export type DripEventSlug =
  | 'selling-a-business'
  | 'death-of-spouse'
  | 'serious-diagnosis'
  | 'receiving-inheritance'
  | 'divorce'
  | 'approaching-retirement'
  | 'large-rsu-vest'
  | 'new-child-grandchild'
  | 'getting-married'
  | 'loss-of-parent'
  | 'estate-tax-law-change'
  | 'first-time-high-net-worth'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app'

export type DripEmail = {
  subject: string
  headline: string
  body: string
  cta: string
  ctaUrl: string
}

export type DripSequence = {
  email1: DripEmail
  email2: DripEmail
  email3: DripEmail
}

const DEFAULT_SEQUENCE: DripSequence = {
  email1: {
    subject: 'Your planning assessment results',
    headline: 'Here\'s what your assessment found',
    body: 'You\'ve identified some important planning gaps. The good news: knowing what\'s missing is the first step. Your personalized action plan is ready.',
    cta: 'See your action plan',
    ctaUrl: `${BASE_URL}/assess`,
  },
  email2: {
    subject: 'The one thing most people in your situation miss',
    headline: 'What your assessment didn\'t show you',
    body: 'Most households at the $2M–$30M level focus on the right topics but miss the timing. The decisions that matter most have windows — and some of those windows are closing.',
    cta: 'Learn what matters most right now',
    ctaUrl: `${BASE_URL}/education`,
  },
  email3: {
    subject: 'Ready to talk to a professional?',
    headline: 'Your plan is more ready than you think',
    body: 'You\'ve assessed your gaps and know what needs attention. The next step is a conversation with an estate attorney or financial advisor — and arriving prepared saves hours.',
    cta: 'Find an advisor or attorney',
    ctaUrl: `${BASE_URL}/find-advisor`,
  },
}

const EVENT_SEQUENCES: Partial<Record<DripEventSlug, DripSequence>> = {
  'selling-a-business': {
    email1: {
      subject: 'Your business sale assessment — what we found',
      headline: 'The estate planning window around a business sale is narrow',
      body: 'Your assessment identified gaps that are time-sensitive. GRAT funding windows, gifting before valuation spikes, and estate tax modeling all need to happen before — or at — closing. Here\'s your action plan.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/selling-a-business`,
    },
    email2: {
      subject: 'What most business sellers learn too late',
      headline: 'The estate tax conversation most owners avoid until it\'s too late',
      body: 'A business sale can double your taxable estate overnight. The strategies that reduce that exposure — GRATs, SLATs, charitable vehicles — must be funded before signing. Once the deal closes, most of these windows are gone permanently.',
      cta: 'Model your estate tax exposure',
      ctaUrl: `${BASE_URL}/event/selling-a-business#action-plan`,
    },
    email3: {
      subject: 'Before you sign: the advisors you need in the room',
      headline: 'An estate attorney and financial advisor before closing',
      body: 'A business sale at your level requires coordinated advice from an estate attorney (trust strategies, timing), a financial advisor (proceeds management, diversification), and your CPA (deal structure, capital gains). Find specialists in your area.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'estate-tax-law-change': {
    email1: {
      subject: 'Your estate tax assessment — the sunset affects you',
      headline: 'The federal exemption is scheduled to drop — here\'s what that means for your estate',
      body: 'Your assessment results are ready. Based on your situation, the scheduled exemption reduction from ~$13.6M to ~$7M per person may significantly affect your estate tax exposure. Here\'s your action plan.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/estate-tax-law-change`,
    },
    email2: {
      subject: 'Use it or lose it — the exemption window',
      headline: 'Gifts made before the sunset are protected',
      body: 'The IRS has confirmed that gifts made under the current higher exemption will not be clawed back if the exemption drops. This means acting now — before year-end — could permanently reduce your taxable estate by millions.',
      cta: 'Learn about gifting strategies',
      ctaUrl: `${BASE_URL}/event/estate-tax-law-change#action-plan`,
    },
    email3: {
      subject: 'The professionals who specialize in exemption planning',
      headline: 'Estate attorneys who specialize in trust strategies and gifting',
      body: 'SLAT funding, GRAT execution, and charitable vehicle structuring all require an estate attorney to execute. These strategies must be in motion well before any deadline. Find specialists now.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'first-time-high-net-worth': {
    email1: {
      subject: 'Your $2M+ planning assessment results',
      headline: 'Crossing $2M changes what planning you need',
      body: 'Your assessment identified the gaps that matter at your wealth level. A basic will and beneficiary designations may have been enough before. At $2M+, the planning requirements are categorically different.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/first-time-high-net-worth`,
    },
    email2: {
      subject: 'What changed when you crossed $2M',
      headline: 'The planning gap most new high-net-worth households discover too late',
      body: 'Beneficiary designations on retirement accounts and life insurance now control more wealth than your will does. State estate taxes may already apply. Asset protection strategies that were unnecessary at $500K are essential at $2M+.',
      cta: 'See what changed',
      ctaUrl: `${BASE_URL}/event/first-time-high-net-worth#action-plan`,
    },
    email3: {
      subject: 'The professionals worth knowing at $2M+',
      headline: 'An estate attorney + financial advisor at this wealth level',
      body: 'At $2M+, the cost of professional estate planning is a rounding error on the assets at risk. The cost of not planning — lost exemptions, probate, estate tax — is not. Find specialists who work with $2M–$30M households.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },
}

export function getDripSequence(eventSlug: string | null): DripSequence {
  if (!eventSlug) return DEFAULT_SEQUENCE
  return EVENT_SEQUENCES[eventSlug as DripEventSlug] ?? DEFAULT_SEQUENCE
}

export function buildDripEmailHtml(params: {
  email: DripEmail
  recipientEmail: string
  unsubscribeUrl: string
}): string {
  const { email, unsubscribeUrl } = params
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${email.subject}</title>
</head>
<body style="margin:0;padding:0;background:#fafaf8;font-family:DM Sans,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 20px rgba(15,31,61,0.08);">

          <tr>
            <td style="background:#0f1f3d;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#c9a84c;width:28px;height:28px;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-family:Georgia,serif;font-weight:700;font-size:14px;color:#0f1f3d;">M</span>
                        </td>
                        <td style="padding-left:10px;">
                          <span style="font-family:Georgia,serif;font-size:15px;font-weight:500;color:white;">My Wealth Maps</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <h1 style="font-family:Georgia,serif;font-size:22px;color:#0f1f3d;margin:0 0 16px;line-height:1.3;">
                ${email.headline}
              </h1>
              <p style="font-size:14px;color:#4a5568;line-height:1.7;margin:0 0 24px;">
                ${email.body}
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#0f1f3d;border-radius:8px;padding:12px 24px;">
                    <a href="${email.ctaUrl}" style="color:white;text-decoration:none;font-size:14px;font-weight:600;">
                      ${email.cta} →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px;">
              <p style="font-size:11px;color:#718096;margin:0;line-height:1.6;">
                You're receiving this because you completed a planning assessment on My Wealth Maps.
                This is not financial, legal, or tax advice — always consult a licensed professional.<br><br>
                <a href="${unsubscribeUrl}" style="color:#718096;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
