import type { LegalSection } from '@/components/legal/LegalDocumentLayout'
import {
  COMPANY_ADDRESS,
  COMPANY_LEGAL_NAME,
  REGISTERED_AGENT,
} from '@/lib/legal/company'

/** ISO date — bump when counsel approves a material policy change. */
export const PRIVACY_POLICY_VERSION = '2026-06-20'

export const PRIVACY_POLICY_LAST_UPDATED = 'June 20, 2026'

export const privacyPolicySections: LegalSection[] = [
  {
    id: 'introduction',
    title: '1. INTRODUCTION & SCOPE',
    blocks: [
      {
        kind: 'p',
        text: `My Wealth Maps is operated by ${COMPANY_LEGAL_NAME}, a Washington State company ("My Wealth Maps," "we," "us," or "our"). We provide estate and financial planning preparation tools at mywealthmaps.com to consumers, financial advisors, and estate attorneys.`,
      },
      {
        kind: 'p',
        text: 'This Privacy Policy explains what personal data we collect, how we use it, who we share it with, and the rights you have. We extend the privacy rights described in Section 7 to all United States residents, regardless of whether your state of residence has a law requiring them. State-specific addenda appear at the end of this Policy.',
      },
      { kind: 'p', text: 'Contact: privacy@mywealthmaps.com' },
      { kind: 'p', text: `Mailing address: ${COMPANY_ADDRESS}` },
    ],
  },
  {
    id: 'what-we-collect',
    title: '2. WHAT INFORMATION WE COLLECT',
    blocks: [
      { kind: 'p', text: 'Information you provide directly:' },
      {
        kind: 'ul',
        items: [
          'Account information: name, email address, password',
          'Household financial data: assets, income, expenses, liabilities, real estate, business interests, insurance policies, gift history, trust structures',
          'Family information: household member names, birth years, relationships, beneficiary designations',
          'Planning preferences: domicile state, filing status, retirement goals, and related planning inputs',
          'Communications: messages to support, feedback, and privacy-rights requests',
        ],
      },
      { kind: 'p', text: 'From advisors and attorneys:' },
      {
        kind: 'p',
        text: 'When a professional invites or collaborates with a household you authorize, we process the data necessary to provide that collaboration.',
      },
      { kind: 'p', text: 'Information collected automatically:' },
      {
        kind: 'ul',
        items: [
          'Usage data: pages visited, features used, and general interaction with the Service',
          'Device information: browser type, operating system, and IP address',
          'Cookies and similar technologies: session management and preferences (see Section 11)',
        ],
      },
      { kind: 'p', text: 'Information from third parties:' },
      {
        kind: 'ul',
        items: [
          'Payment information: processed by Stripe — we do not store full card numbers',
          'Advisor and attorney connections: limited profile information when you connect with a professional, as described in Section 5',
        ],
      },
    ],
  },
  {
    id: 'how-we-use',
    title: '3. HOW WE USE YOUR INFORMATION',
    blocks: [
      { kind: 'p', text: 'We use personal data to:' },
      {
        kind: 'ul',
        items: [
          'Provide, operate, and improve the Service, including estate-tax and planning calculations',
          'Display your household financial picture and planning readiness',
          'Enable advisor and attorney collaboration you authorize',
          'Process payments, manage subscriptions, and send transactional emails (confirmations, receipts, renewal reminders required by law, security alerts)',
          'Send marketing communications when you have consented (you may withdraw consent at any time)',
          'Maintain security, prevent fraud, and comply with legal obligations',
        ],
      },
      { kind: 'p', text: 'We do not:' },
      {
        kind: 'ul',
        items: [
          'Sell your personal information',
          'Share your data with advertisers or use it for cross-context behavioral advertising',
          'Use your financial data to train AI models',
          'Use your data for profiling that produces legal or similarly significant effects',
        ],
      },
    ],
  },
  {
    id: 'purposes',
    title: '4. PURPOSES OF PROCESSING',
    blocks: [
      {
        kind: 'p',
        text: 'We process personal data to deliver the Service you request, to meet our legal obligations (including tax and billing record retention and breach notification), to protect the Service and our users, and — for marketing communications only — based on your consent, which you may withdraw at any time.',
      },
    ],
  },
  {
    id: 'how-we-share',
    title: '5. HOW WE SHARE YOUR INFORMATION',
    blocks: [
      { kind: 'p', text: 'With advisors and attorneys you connect:' },
      {
        kind: 'p',
        text: 'When you invite an advisor or attorney and they accept, they can view your household financial data within the platform. You control these connections and can revoke access from your account settings.',
      },
      { kind: 'p', text: 'With service providers (data processors):' },
      {
        kind: 'ul',
        items: [
          'Supabase: database and authentication (United States)',
          'Vercel: application hosting (United States)',
          'Stripe: payment processing (does not receive your financial planning data)',
          'Resend: transactional and marketing email delivery',
          'Sentry: error monitoring (errors only; we configure Sentry not to collect personal information by default)',
        ],
      },
      {
        kind: 'p',
        text: 'Each provider processes data on our behalf under a Data Processing Agreement or equivalent contractual terms. We do not authorize them to use your data for their own purposes.',
      },
      {
        kind: 'p',
        text: 'We do not sell or share personal information for cross-context behavioral advertising. We do not share your data with other third parties except:',
      },
      {
        kind: 'ul',
        items: [
          'When required by law, court order, or government request',
          'To protect the rights, property, or safety of My Wealth Maps or our users',
          'In connection with a merger or acquisition (you will be notified)',
        ],
      },
    ],
  },
  {
    id: 'data-retention',
    title: '6. DATA RETENTION & DELETION',
    blocks: [
      {
        kind: 'p',
        text: 'We retain personal data while your account is active. If you delete your account, we delete your personal data within 30 days, except where law requires retention (for example, billing records for up to seven years per IRS requirements).',
      },
      {
        kind: 'p',
        text: 'Anonymized, aggregated data not linked to you may be retained for product improvement.',
      },
    ],
  },
  {
    id: 'your-rights',
    title: '7. YOUR PRIVACY RIGHTS (ALL U.S. RESIDENTS)',
    blocks: [
      {
        kind: 'p',
        text: 'Every United States resident may request the following, subject to identity verification:',
      },
      {
        kind: 'ul',
        items: [
          'Access / Know: what personal data we process about you',
          'Correction: fix inaccurate personal data',
          'Deletion: delete your personal data',
          'Portability: receive your data in a structured, commonly used, machine-readable format',
          'Opt-out of sale and sharing: we do not sell or share personal information; you may still submit an opt-out request',
          'Opt-out of targeted advertising: we do not use personal data for targeted advertising',
          'Opt-out of profiling: we do not perform profiling that produces legal or similarly significant effects',
          'Withdraw consent to marketing emails at any time',
          'Appeal: if we decline a request, as described in Section 8',
        ],
      },
      {
        kind: 'p',
        text: 'How to exercise: submit a request in-app at Settings → Security → Privacy Rights, or email privacy@mywealthmaps.com. We respond within 45 days and may extend once by an additional 45 days where reasonably necessary, with notice to you. You will receive a confirmation email with a reference ID. We will not charge a fee for up to two requests per 12-month period.',
      },
      {
        kind: 'p',
        text: 'Authorized agents: you may use an authorized agent to submit a request on your behalf. We may require the agent to provide proof of authorization and may require you to verify your identity directly.',
      },
      {
        kind: 'p',
        text: 'We will not discriminate against you for exercising your privacy rights.',
      },
    ],
  },
  {
    id: 'appeals',
    title: '8. APPEALS',
    blocks: [
      {
        kind: 'p',
        text: 'If we decline to act on a privacy request, we will explain why in our response and tell you how to appeal. To appeal, reply to your confirmation or decision email or email privacy@mywealthmaps.com with your reference ID.',
      },
      {
        kind: 'p',
        text: 'We will respond to an appeal in writing within 60 days. If we deny your appeal, we will explain the reason and provide information on how to contact your state Attorney General or other applicable regulator.',
      },
    ],
  },
  {
    id: 'security',
    title: '9. DATA SECURITY',
    blocks: [
      { kind: 'p', text: 'We implement administrative, technical, and physical safeguards appropriate to the sensitivity of the data, including:' },
      {
        kind: 'ul',
        items: [
          'Encryption in transit: TLS 1.2+ on all connections',
          'Encryption at rest: AES-256 via Supabase (Postgres)',
          'Access controls: row-level security policies on database tables',
          'Authentication: email verification and optional two-factor authentication',
          'Session management: short-lived tokens with automatic refresh',
        ],
      },
      {
        kind: 'p',
        text: 'No method of transmission or storage is perfectly secure. If you believe your account has been compromised, contact security@mywealthmaps.com immediately.',
      },
    ],
  },
  {
    id: 'breach-notification',
    title: '10. DATA BREACH NOTIFICATION',
    blocks: [
      {
        kind: 'p',
        text: 'In the event of a data breach affecting your personal information, we will notify you without unreasonable delay and in accordance with applicable law, including Washington RCW 19.255.010 (within 30 days of discovery where that statute applies). If a breach affects more than 500 Washington residents, we will also notify the Washington Attorney General. We will comply with breach-notification laws of your state of residence as applicable.',
      },
    ],
  },
  {
    id: 'cookies',
    title: '11. COOKIES & TRACKING',
    blocks: [
      { kind: 'p', text: 'We use cookies and similar technologies for:' },
      {
        kind: 'ul',
        items: [
          'Session management: keeping you logged in',
          'Security: CSRF protection',
          'Preferences: remembering your settings',
        ],
      },
      {
        kind: 'p',
        text: 'We do not use advertising cookies or third-party tracking pixels for cross-context behavioral advertising. You can control cookies through your browser settings; disabling cookies may prevent some features from working correctly.',
      },
      {
        kind: 'p',
        text: 'We honor recognized universal opt-out signals (such as Global Privacy Control) as a valid opt-out of sale or sharing of personal information, to the extent applicable. We do not sell or share personal information.',
      },
    ],
  },
  {
    id: 'children',
    title: "12. CHILDREN'S PRIVACY",
    blocks: [
      {
        kind: 'p',
        text: 'The Service is intended only for adults 18 years of age and older. We do not knowingly collect personal information from anyone under 18. If we learn we have collected such data, we will delete it. Contact privacy@mywealthmaps.com if you believe a minor has provided us with personal information.',
      },
    ],
  },
  {
    id: 'changes',
    title: '13. CHANGES TO THIS POLICY',
    blocks: [
      {
        kind: 'p',
        text: 'We may update this Privacy Policy from time to time. We will post changes here with an updated version and effective date. Material changes will be communicated by email or platform notice at least 30 days before the effective date where required by law. Continued use after the effective date constitutes acceptance where permitted.',
      },
    ],
  },
  {
    id: 'contact',
    title: '14. CONTACT US',
    blocks: [
      { kind: 'p', text: 'Privacy questions: privacy@mywealthmaps.com' },
      { kind: 'p', text: 'Security concerns: security@mywealthmaps.com' },
      { kind: 'p', text: `Mailing address: ${COMPANY_ADDRESS}` },
      { kind: 'p', text: `Washington State registered agent: ${REGISTERED_AGENT}` },
    ],
  },
]
