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

  'death-of-spouse': {
    email1: {
      subject: 'Your assessment results — estate steps after losing a spouse',
      headline: 'The decisions that can\'t wait — and the ones that can',
      body: 'Losing a spouse triggers a cascade of estate and financial tasks, many with hard deadlines. Your assessment identified the gaps most urgent for your situation. Some decisions must happen within months; others can wait until you\'re ready.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/death-of-spouse`,
    },
    email2: {
      subject: 'The deadlines most surviving spouses miss',
      headline: 'Portability, beneficiary updates, and retitling — the clock is running',
      body: 'The federal estate tax portability election must be filed within nine months of death. Retirement account beneficiary designations, asset retitling, and trust funding have their own timelines. Missing these windows can cost your estate millions.',
      cta: 'Review the critical deadlines',
      ctaUrl: `${BASE_URL}/event/death-of-spouse#action-plan`,
    },
    email3: {
      subject: 'The professionals who specialize in post-loss estate work',
      headline: 'An estate attorney experienced in spousal loss',
      body: 'Portability elections, inherited IRA rules, and estate settlement require an estate attorney familiar with post-loss planning. A financial advisor can help restructure assets and income. Find specialists who work with surviving spouses at the $2M–$30M level.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'serious-diagnosis': {
    email1: {
      subject: 'Your assessment results — planning around a serious diagnosis',
      headline: 'What needs to be in place — and what you still have time to do',
      body: 'A serious health diagnosis changes the urgency of estate planning in specific ways. Your assessment identified what\'s missing. Some decisions — incapacity documents, trust funding, beneficiary alignment — have immediate importance. Others can be addressed over time.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/serious-diagnosis`,
    },
    email2: {
      subject: 'The documents that protect your family if you can\'t make decisions',
      headline: 'Durable power of attorney, healthcare proxy, and trust funding',
      body: 'Without a durable power of attorney, your family may need court intervention to manage your financial affairs. A healthcare proxy ensures your medical wishes are followed. Funding your revocable trust avoids probate on assets that haven\'t been retitled. These are the documents that matter most right now.',
      cta: 'Review what needs to be in place',
      ctaUrl: `${BASE_URL}/event/serious-diagnosis#action-plan`,
    },
    email3: {
      subject: 'Estate attorneys who specialize in time-sensitive planning',
      headline: 'An estate attorney who can move quickly',
      body: 'When time is a factor, you need an attorney who can prioritize incapacity documents, trust funding, and beneficiary alignment without the usual multi-month timeline. Find estate attorneys in your area who work with clients navigating a health diagnosis.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'receiving-inheritance': {
    email1: {
      subject: 'Your inheritance assessment results',
      headline: 'An inheritance changes your estate — here\'s what to address first',
      body: 'Receiving a significant inheritance can push your taxable estate above thresholds you\'ve never had to think about before. Your assessment identified the gaps most relevant to your situation — including state estate tax exposure and beneficiary alignment on newly inherited accounts.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/receiving-inheritance`,
    },
    email2: {
      subject: 'What most heirs don\'t realize about inherited accounts',
      headline: 'Inherited IRAs, step-up basis, and the 10-year rule',
      body: 'The rules around inherited retirement accounts changed significantly in 2020. Most non-spouse beneficiaries must now deplete inherited IRAs within 10 years — with significant tax implications. Inherited non-retirement assets typically receive a step-up in cost basis. How you handle these assets in the first year matters.',
      cta: 'Understand the inherited account rules',
      ctaUrl: `${BASE_URL}/event/receiving-inheritance#action-plan`,
    },
    email3: {
      subject: 'The advisors who specialize in inheritance planning',
      headline: 'A CPA, estate attorney, and financial advisor — in that order',
      body: 'Receiving a large inheritance typically requires a CPA (tax implications of inherited assets), an estate attorney (updating your own plan to reflect new wealth), and a financial advisor (integrating inherited assets into your portfolio). Find specialists who work with $2M–$30M households.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'divorce': {
    email1: {
      subject: 'Your divorce planning assessment results',
      headline: 'Divorce rewrites your estate plan — here\'s what needs immediate attention',
      body: 'Divorce invalidates beneficiary designations, changes asset titling, and may affect trust structures — none of which happen automatically. Your assessment identified the gaps most urgent for your situation. Acting on these before the divorce is final can prevent costly mistakes.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/divorce`,
    },
    email2: {
      subject: 'The beneficiary designations that survive your divorce',
      headline: 'Your will may be void — but retirement accounts and life insurance aren\'t',
      body: 'Many states automatically revoke ex-spouse provisions in a will after divorce. But retirement accounts, life insurance, and payable-on-death accounts follow the beneficiary designation on file — regardless of divorce. An ex-spouse named as beneficiary on a 401(k) ten years ago may still inherit it today.',
      cta: 'Review what changes after divorce',
      ctaUrl: `${BASE_URL}/event/divorce#action-plan`,
    },
    email3: {
      subject: 'The attorneys and advisors who specialize in high-asset divorce',
      headline: 'Estate attorney, financial advisor, and CDFA — the team you need',
      body: 'High-asset divorces require a Certified Divorce Financial Analyst (CDFA) to model settlement scenarios, an estate attorney to update your plan, and a financial advisor to restructure your assets post-settlement. Find specialists who work with $2M–$30M households.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'approaching-retirement': {
    email1: {
      subject: 'Your retirement planning assessment results',
      headline: 'The estate and tax decisions that must happen before you retire',
      body: 'Retirement is one of the most consequential estate planning transitions. Your assessment identified the gaps most relevant to your situation — including Social Security timing, RMD planning, Roth conversion windows, and beneficiary alignment that should be addressed before your income changes.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/approaching-retirement`,
    },
    email2: {
      subject: 'The Roth conversion window closing as you approach retirement',
      headline: 'Lower-income years before RMDs are the Roth conversion opportunity',
      body: 'The years between retirement and age 73 — when Required Minimum Distributions begin — are often the lowest-income years of your life. Converting traditional IRA assets to Roth during this window can significantly reduce your lifetime tax burden and your taxable estate.',
      cta: 'Model your Roth conversion opportunity',
      ctaUrl: `${BASE_URL}/event/approaching-retirement#action-plan`,
    },
    email3: {
      subject: 'The advisors who specialize in retirement transition planning',
      headline: 'A financial advisor and estate attorney for your retirement transition',
      body: 'Retirement transition planning at the $2M–$30M level involves Social Security optimization, RMD strategy, Roth conversion modeling, and estate plan updates — all at once. Find advisors and estate attorneys who specialize in this transition.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'large-rsu-vest': {
    email1: {
      subject: 'Your RSU vest assessment results',
      headline: 'A large RSU vest changes your estate — here\'s what to address',
      body: 'A significant RSU vest can push your taxable estate above thresholds that require active planning. Your assessment identified the gaps most relevant to your situation — including concentration risk, gifting opportunities before shares appreciate further, and estate tax exposure from sudden wealth.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/large-rsu-vest`,
    },
    email2: {
      subject: 'The gifting window after a vest — before shares appreciate',
      headline: 'Gifts of appreciated stock have a lower gift tax cost',
      body: 'Shares gifted immediately after vest are valued at the vest price — before any further appreciation. If those shares grow significantly, the appreciation happens outside your taxable estate. Gifting to a trust or directly to beneficiaries in the months following a vest can be meaningfully more efficient than waiting.',
      cta: 'Understand the gifting timing',
      ctaUrl: `${BASE_URL}/event/large-rsu-vest#action-plan`,
    },
    email3: {
      subject: 'The advisors who specialize in equity compensation planning',
      headline: 'A financial advisor and estate attorney for equity planning',
      body: 'RSU planning at the $2M–$30M level requires a financial advisor (diversification, concentration risk), an estate attorney (trust strategies, gifting structures), and a CPA (tax treatment of vest and sale). Find specialists who work with executives and employees at this wealth level.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'new-child-grandchild': {
    email1: {
      subject: 'Your assessment results — planning after a new child or grandchild',
      headline: 'A new family member changes who inherits — and how',
      body: 'The arrival of a child or grandchild is the most common trigger for updating an estate plan — and the most commonly delayed. Your assessment identified what needs to be updated: guardian designations, trust structures, beneficiary alignments, and 529 funding strategy.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/new-child-grandchild`,
    },
    email2: {
      subject: 'The guardian designation most parents forget to update',
      headline: 'Who raises your children if you can\'t — and who manages their inheritance',
      body: 'Guardian designations in your will name who raises your minor children. But a separate trustee should manage any assets they inherit — and that person may not be the same as the guardian. Without a trust, a minor child who inherits significant assets may receive them outright at 18, with no oversight.',
      cta: 'Review guardian and trustee decisions',
      ctaUrl: `${BASE_URL}/event/new-child-grandchild#action-plan`,
    },
    email3: {
      subject: 'Estate attorneys who specialize in family planning',
      headline: 'An estate attorney to update your will, trust, and beneficiary designations',
      body: 'Adding a child or grandchild requires updating your will (guardian designation), your revocable trust (beneficiary and distribution provisions), and beneficiary designations on all retirement accounts and life insurance. An estate attorney can handle all of this in a single engagement.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'getting-married': {
    email1: {
      subject: 'Your marriage planning assessment results',
      headline: 'Marriage changes your estate plan in ways most couples don\'t address',
      body: 'Marriage is a legal event with significant estate planning implications — community property rules, spousal elective share rights, beneficiary designations that may now be outdated, and the question of whether assets should be separate or jointly titled. Your assessment identified what needs attention.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/getting-married`,
    },
    email2: {
      subject: 'The beneficiary designations that don\'t automatically update with marriage',
      headline: 'Retirement accounts and life insurance still name your ex — or your parents',
      body: 'Marriage does not automatically update beneficiary designations on retirement accounts, life insurance, or payable-on-death accounts. In many states, a new spouse has statutory rights that override a beneficiary designation — but the legal process to enforce those rights can be costly and slow. Update designations now.',
      cta: 'Review what changes after marriage',
      ctaUrl: `${BASE_URL}/event/getting-married#action-plan`,
    },
    email3: {
      subject: 'Estate attorneys who specialize in married couple planning',
      headline: 'An estate attorney to build or update your joint estate plan',
      body: 'Newly married couples at the $2M–$30M level typically need a joint revocable trust, updated wills with spousal provisions, healthcare proxies and durable powers of attorney for both spouses, and a review of asset titling. Find estate attorneys who specialize in married couple planning.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'loss-of-parent': {
    email1: {
      subject: 'Your assessment results — estate planning after losing a parent',
      headline: 'Inheriting from a parent often reveals gaps in your own plan',
      body: 'The loss of a parent frequently triggers two parallel processes: settling their estate and updating your own. Your assessment identified the planning gaps most relevant to your situation — including how an inheritance may affect your estate tax exposure and what your own documents say.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/loss-of-parent`,
    },
    email2: {
      subject: 'What the estate settlement process reveals about your own plan',
      headline: 'What you\'ll deal with in their estate — and what it means for yours',
      body: 'Settling a parent\'s estate surfaces the practical consequences of planning decisions — or their absence. Beneficiary designations that don\'t match the will. Assets titled outside the trust. Accounts that have to go through probate. These are the same gaps that may exist in your own plan right now.',
      cta: 'Review your own plan',
      ctaUrl: `${BASE_URL}/event/loss-of-parent#action-plan`,
    },
    email3: {
      subject: 'Estate attorneys who help with both settlement and your own planning',
      headline: 'An estate attorney for the settlement — and your own update',
      body: 'An estate attorney can help you settle your parent\'s estate and update your own plan in the same engagement. This is often the most efficient time to review your own documents, trust funding, and beneficiary designations — while the gaps are visible and the motivation is fresh.',
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
