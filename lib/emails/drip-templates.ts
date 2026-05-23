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
  | 'remarriage-blended-family'
  | 'aging-parent-needs-care'
  | 'starting-a-business'
  | 'selling-a-home'
  | 'multi-state-real-estate'
  | 'child-reaching-adulthood'
  | 'disability-early-retirement'
  | 'major-job-change'
  | 'five-year-plan-review'
  | 'rmd-start-age'
  | 'medicare-eligibility'
  | 'social-security-timing'

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

  'remarriage-blended-family': {
    email1: {
      subject: 'Your blended family planning assessment results',
      headline: 'Remarriage with children from prior relationships changes everything about your estate plan',
      body: 'Your assessment identified the gaps most common in blended family situations. Without careful trust structuring, assets intended for your children may pass to a surviving spouse — and vice versa. Here\'s your action plan.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/remarriage-blended-family`,
    },
    email2: {
      subject: 'The estate planning problem most blended families discover too late',
      headline: 'A simple will doesn\'t protect both your spouse and your children',
      body: 'When you leave everything to a surviving spouse outright, your children from a prior relationship depend entirely on that spouse\'s generosity. A QTIP trust or similar structure can provide for your spouse during their lifetime while ensuring your children receive their inheritance.',
      cta: 'Understand blended family trust structures',
      ctaUrl: `${BASE_URL}/event/remarriage-blended-family#action-plan`,
    },
    email3: {
      subject: 'Estate attorneys who specialize in blended family planning',
      headline: 'An estate attorney experienced in blended family trust structures',
      body: 'QTIP trusts, separate property agreements, and beneficiary alignment across both spouses\' estates require an attorney who specializes in blended family situations. Find estate attorneys in your area who work with $2M–$30M blended households.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'aging-parent-needs-care': {
    email1: {
      subject: 'Your assessment results — planning while a parent needs care',
      headline: 'A parent\'s care needs can affect both their estate and yours',
      body: 'Your assessment identified the planning gaps most relevant when a parent is aging or needs care. Medicaid lookback rules, gift documentation, and your own plan\'s exposure to caregiving costs all warrant attention now.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/aging-parent-needs-care`,
    },
    email2: {
      subject: 'The Medicaid lookback rule most families learn about too late',
      headline: 'Gifts made within five years of a Medicaid application can disqualify coverage',
      body: 'If your parent may eventually need Medicaid-funded nursing care, gifts they made in the prior five years — including transfers to family members — are counted. Understanding this now, while options still exist, can protect both your parent\'s care access and their estate.',
      cta: 'Review the key planning considerations',
      ctaUrl: `${BASE_URL}/event/aging-parent-needs-care#action-plan`,
    },
    email3: {
      subject: 'Elder law attorneys and advisors who specialize in care planning',
      headline: 'An elder law attorney for your parent — and an estate attorney for your own plan',
      body: 'Elder law attorneys specialize in Medicaid planning, care coordination, and asset protection for aging parents. While addressing your parent\'s situation, it\'s also the right time to review your own plan — caregiving responsibilities often affect your own retirement timeline.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'starting-a-business': {
    email1: {
      subject: 'Your new business planning assessment results',
      headline: 'Starting a business changes your estate plan from day one',
      body: 'Your assessment identified the planning gaps most relevant when starting a business. Entity structure, buy-sell agreements, and personal asset protection are decisions that are much easier to make now — before the business has significant value — than later.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/starting-a-business`,
    },
    email2: {
      subject: 'The estate planning decision most new business owners defer too long',
      headline: 'Your business entity structure determines what your heirs inherit',
      body: 'An LLC or S-Corp can provide liability protection during your lifetime. But how the business is titled, whether it\'s in a trust, and what a buy-sell agreement says determines what happens at your death. These decisions are most flexible when the business is new and its value is low.',
      cta: 'Review business estate planning basics',
      ctaUrl: `${BASE_URL}/event/starting-a-business#action-plan`,
    },
    email3: {
      subject: 'The advisors who specialize in business owner estate planning',
      headline: 'An estate attorney and financial advisor who work with business owners',
      body: 'Business owner estate planning requires an estate attorney (entity structure, buy-sell agreements, trust ownership), a financial advisor (business valuation, income planning), and a CPA (entity tax treatment). Find specialists who work with $2M–$30M business owners.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'selling-a-home': {
    email1: {
      subject: 'Your home sale planning assessment results',
      headline: 'A home sale generates proceeds that need a plan',
      body: 'Your assessment identified the planning considerations most relevant to a significant home sale. Capital gains exclusions, proceeds titling, and the impact on your overall estate all warrant attention before or at closing.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/selling-a-home`,
    },
    email2: {
      subject: 'The capital gains exclusion most sellers don\'t fully use',
      headline: 'Up to $500K excluded — but the rules are specific',
      body: 'Married couples can exclude up to $500,000 in home sale gains from federal income tax if they\'ve lived in the home for two of the prior five years. But partial exclusions, second homes, and homes held in trust have different rules. Understanding your specific situation before closing can save significantly.',
      cta: 'Review the capital gains rules',
      ctaUrl: `${BASE_URL}/event/selling-a-home#action-plan`,
    },
    email3: {
      subject: 'The advisors to involve before a significant home sale',
      headline: 'A CPA and financial advisor before closing',
      body: 'A significant home sale requires a CPA (capital gains calculation, exclusion qualification, 1031 exchange if applicable) and a financial advisor (proceeds deployment, updated projections, estate impact). An estate attorney may also be needed if the home was held in trust.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'multi-state-real-estate': {
    email1: {
      subject: 'Your multi-state real estate assessment results',
      headline: 'Property in multiple states creates probate risk in every state',
      body: 'Your assessment identified the estate planning gaps most relevant to multi-state property ownership. Without trust ownership of each property, your estate may face separate probate proceedings in every state where you own real estate — a costly and time-consuming process for your heirs.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/multi-state-real-estate`,
    },
    email2: {
      subject: 'The multi-state probate problem most property owners don\'t see coming',
      headline: 'Each state where you own real estate has jurisdiction over that property',
      body: 'Your will is probated in your state of residence. But real estate is governed by the state where it sits. A vacation home in another state, rental properties across state lines — each requires a separate ancillary probate unless the property is owned by a trust or LLC. At $2M–$30M, this is both avoidable and worth avoiding.',
      cta: 'Review multi-state probate risk',
      ctaUrl: `${BASE_URL}/event/multi-state-real-estate#action-plan`,
    },
    email3: {
      subject: 'Estate attorneys who specialize in multi-state property planning',
      headline: 'An estate attorney who can coordinate across states',
      body: 'Retitling real estate into a revocable trust, structuring LLC ownership, and coordinating beneficiary designations across multiple states requires an estate attorney familiar with multi-state property planning. Find specialists who work with $2M–$30M real estate portfolios.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'child-reaching-adulthood': {
    email1: {
      subject: 'Your assessment results — planning as a child reaches adulthood',
      headline: 'A child turning 18 changes your estate plan in ways most parents don\'t address',
      body: 'Your assessment identified the planning updates most relevant when a child reaches adulthood. At 18, they can no longer be covered by your healthcare proxy and durable power of attorney — and any inheritance they receive may come to them outright without the structure you intended.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/child-reaching-adulthood`,
    },
    email2: {
      subject: 'What changes when your child turns 18',
      headline: 'At 18, your child needs their own legal documents — and your plan needs updating',
      body: 'A child who turns 18 is a legal adult. If they are in an accident, you have no legal authority to make healthcare decisions without a healthcare proxy naming you. Your estate plan may also distribute assets to them outright at 18 — an age most parents consider too young for a significant inheritance without trustee oversight.',
      cta: 'Review what changes at 18',
      ctaUrl: `${BASE_URL}/event/child-reaching-adulthood#action-plan`,
    },
    email3: {
      subject: 'Estate attorneys who can update both your plan and your child\'s documents',
      headline: 'An estate attorney for the update — and basic documents for your child',
      body: 'When a child reaches adulthood, most estate attorneys recommend updating trust distribution provisions and drafting basic documents for the child (healthcare proxy, durable power of attorney). Find estate attorneys in your area who work with $2M–$30M families.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'disability-early-retirement': {
    email1: {
      subject: 'Your assessment results — planning around disability or early retirement',
      headline: 'Disability or early retirement changes the urgency of several planning decisions',
      body: 'Your assessment identified the gaps most relevant to your situation. When earned income stops earlier than planned, Social Security filing strategy, income sequencing, and incapacity documents all become more urgent — not less.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/disability-early-retirement`,
    },
    email2: {
      subject: 'The incapacity planning gap disability makes urgent',
      headline: 'A durable power of attorney and healthcare proxy before you need them',
      body: 'Disability often arrives without warning. A durable power of attorney gives a trusted person authority over your financial affairs if you cannot manage them. A healthcare proxy ensures your medical wishes are followed. Without these documents in place, your family may need court intervention — slow, expensive, and public.',
      cta: 'Review incapacity planning essentials',
      ctaUrl: `${BASE_URL}/event/disability-early-retirement#action-plan`,
    },
    email3: {
      subject: 'Advisors who specialize in disability and early retirement planning',
      headline: 'A financial advisor and estate attorney for your situation',
      body: 'Disability and early retirement planning requires a financial advisor (income replacement, Social Security strategy, portfolio sequencing) and an estate attorney (incapacity documents, trust funding, beneficiary review). Find specialists who work with $2M–$30M households navigating this transition.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'major-job-change': {
    email1: {
      subject: 'Your job change planning assessment results',
      headline: 'A major job change affects your retirement accounts, equity, and estate plan',
      body: 'Your assessment identified the planning gaps most relevant to a job change. 401(k) rollover decisions, unvested equity forfeitures, deferred compensation timing, and beneficiary designations on old employer accounts are all time-sensitive.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/major-job-change`,
    },
    email2: {
      subject: 'The 401(k) rollover decision most people get wrong',
      headline: 'Rolling over to an IRA vs. new employer plan — the estate implications differ',
      body: 'Rolling a 401(k) into an IRA gives you more investment flexibility but removes some creditor protection available in employer plans. Rolling into a new employer\'s 401(k) may preserve those protections. The right answer depends on your state, your assets, and your estate plan — not just investment options.',
      cta: 'Review the rollover considerations',
      ctaUrl: `${BASE_URL}/event/major-job-change#action-plan`,
    },
    email3: {
      subject: 'The advisors to involve during a job transition',
      headline: 'A financial advisor and CPA during your transition window',
      body: 'A major job change requires a financial advisor (rollover strategy, equity planning, updated projections) and a CPA (deferred compensation tax treatment, stock option timing, capital gains). An estate attorney should review beneficiary designations on old employer accounts.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'five-year-plan-review': {
    email1: {
      subject: 'Your five-year plan review assessment results',
      headline: 'A lot changes in five years — here\'s what your plan needs to reflect',
      body: 'Your assessment identified the gaps most common in plans that haven\'t been reviewed recently. Asset values, family circumstances, tax law, and your own goals have likely all shifted. Here\'s what needs attention.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/five-year-plan-review`,
    },
    email2: {
      subject: 'The parts of your estate plan most likely to be outdated',
      headline: 'Beneficiary designations, trust provisions, and exemption amounts all change',
      body: 'The federal estate tax exemption has changed multiple times in the past five years and is scheduled to change again. Beneficiary designations on retirement accounts and life insurance may name people or relationships that no longer reflect your wishes. Trust distribution ages may no longer match your intentions for your beneficiaries.',
      cta: 'Review what typically goes stale',
      ctaUrl: `${BASE_URL}/event/five-year-plan-review#action-plan`,
    },
    email3: {
      subject: 'Estate attorneys who specialize in plan reviews',
      headline: 'An estate attorney for a full plan review',
      body: 'A five-year plan review with an estate attorney typically covers your will and trust documents, beneficiary designations across all accounts, healthcare proxy and durable power of attorney currency, and estate tax exposure given current law. Find estate attorneys in your area who work with $2M–$30M households.',
      cta: 'Find an estate attorney',
      ctaUrl: `${BASE_URL}/find-attorney`,
    },
  },

  'rmd-start-age': {
    email1: {
      subject: 'Your RMD planning assessment results',
      headline: 'Required Minimum Distributions begin between ages 72 and 75 — here\'s what that means for your plan',
      body: 'Your assessment identified the planning considerations most relevant as RMDs approach. RMDs change your taxable income, your Roth conversion opportunity, and how retirement assets will ultimately pass to your heirs. Here\'s your action plan.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/rmd-start-age`,
    },
    email2: {
      subject: 'The Roth conversion window that closes when RMDs begin',
      headline: 'Converting before RMDs begin reduces both your tax bill and your taxable estate',
      body: 'Once RMDs begin, they count as ordinary income and can push you into higher tax brackets. Converting traditional IRA assets to Roth before your RMD start age — while you have control over your taxable income — can reduce lifetime taxes and leave Roth assets to heirs income-tax-free. This window is closing.',
      cta: 'Model your Roth conversion opportunity',
      ctaUrl: `${BASE_URL}/event/rmd-start-age#action-plan`,
    },
    email3: {
      subject: 'Advisors who specialize in RMD and distribution planning',
      headline: 'A financial advisor for RMD strategy and a CPA for tax coordination',
      body: 'RMD planning at the $2M–$30M level requires a financial advisor (withdrawal sequencing, Roth conversion modeling, beneficiary IRA strategy) and a CPA (income tax impact, QCD opportunities for charitable giving). An estate attorney should review beneficiary designations on all retirement accounts.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'medicare-eligibility': {
    email1: {
      subject: 'Your Medicare planning assessment results',
      headline: 'Medicare eligibility at 65 is a planning inflection point',
      body: 'Your assessment identified the considerations most relevant as you approach Medicare eligibility. Healthcare cost assumptions, IRMAA surcharge exposure, and the interaction between Medicare timing and early retirement income all affect your broader financial plan.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/medicare-eligibility`,
    },
    email2: {
      subject: 'The IRMAA surcharge most high-income retirees don\'t plan for',
      headline: 'Medicare Part B and D premiums increase significantly above certain income thresholds',
      body: 'Medicare\'s Income-Related Monthly Adjustment Amount (IRMAA) adds significant surcharges to Part B and Part D premiums for higher-income retirees. These surcharges are based on income from two years prior — meaning decisions made today affect your premiums at 65. Roth conversions, asset sales, and RMD timing all affect IRMAA exposure.',
      cta: 'Review Medicare income planning',
      ctaUrl: `${BASE_URL}/event/medicare-eligibility#action-plan`,
    },
    email3: {
      subject: 'Advisors who specialize in Medicare and retirement income planning',
      headline: 'A financial advisor who coordinates Medicare with your retirement income plan',
      body: 'Medicare planning at the $2M–$30M level requires a financial advisor who understands IRMAA thresholds, Medigap vs. Medicare Advantage tradeoffs, and how retirement income decisions interact with healthcare costs. Find advisors in your area who specialize in retirement income planning.',
      cta: 'Find an advisor',
      ctaUrl: `${BASE_URL}/find-advisor`,
    },
  },

  'social-security-timing': {
    email1: {
      subject: 'Your Social Security timing assessment results',
      headline: 'Social Security timing is one of the highest-leverage retirement decisions you have',
      body: 'Your assessment identified the considerations most relevant to your Social Security filing decision. Filing age, spousal benefit coordination, survivor benefit strategy, and the interaction with your other retirement income sources all affect the lifetime value of your Social Security benefit significantly.',
      cta: 'See your action plan',
      ctaUrl: `${BASE_URL}/event/social-security-timing`,
    },
    email2: {
      subject: 'The Social Security break-even analysis most people get wrong',
      headline: 'Break-even age is only part of the calculation',
      body: 'The standard Social Security break-even analysis compares cumulative benefits at different filing ages. But it ignores survivor benefits, spousal coordination, portfolio longevity, and tax implications of benefits at different income levels. For married couples especially, the optimal filing strategy depends on both spouses\' ages, health, and benefit amounts.',
      cta: 'Understand the full filing decision',
      ctaUrl: `${BASE_URL}/event/social-security-timing#action-plan`,
    },
    email3: {
      subject: 'Advisors who specialize in Social Security optimization',
      headline: 'A financial advisor for Social Security strategy',
      body: 'Social Security optimization at the $2M–$30M level requires a financial advisor who can model filing scenarios across both spouses, coordinate with portfolio withdrawal strategy, and account for survivor benefit implications. Find advisors in your area who specialize in retirement income planning.',
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
