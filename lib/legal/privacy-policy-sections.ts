import type { LegalSection } from '@/components/legal/LegalDocumentLayout'
import {
  COMPANY_ADDRESS,
  COMPANY_LEGAL_NAME,
  REGISTERED_AGENT,
} from '@/lib/legal/company'

export const PRIVACY_POLICY_LAST_UPDATED = 'June 2, 2026'

export const privacyPolicySections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: '1. WHO WE ARE',
    blocks: [
      {
        kind: 'p',
        text: `My Wealth Maps is operated by ${COMPANY_LEGAL_NAME}, a Washington State company ("My Wealth Maps," "we," "us," or "our"). We provide financial planning preparation tools at mywealthmaps.com.`,
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
          'Family information: household member names, birth years, relationships',
          'Planning preferences: domicile state, filing status, retirement goals',
          'Communications: messages to support, feedback',
        ],
      },
      { kind: 'p', text: 'Information collected automatically:' },
      {
        kind: 'ul',
        items: [
          'Usage data: pages visited, features used, time spent',
          'Device information: browser type, operating system, IP address',
          'Cookies and similar technologies: session management, preferences',
        ],
      },
      { kind: 'p', text: 'Information from third parties:' },
      {
        kind: 'ul',
        items: [
          'Payment information: processed by Stripe — we do not store card numbers',
          'Advisor and attorney connections: if you connect a professional, limited profile information is shared with them as described in Section 5',
        ],
      },
    ],
  },
  {
    id: 'how-we-use',
    title: '3. HOW WE USE YOUR INFORMATION',
    blocks: [
      { kind: 'p', text: 'We use your information to:' },
      {
        kind: 'ul',
        items: [
          'Provide and improve the planning tools and calculations',
          'Display your household financial picture and planning readiness',
          'Send transactional emails: account confirmation, receipts, plan summaries',
          'Send service emails: renewal reminders (required by law), security alerts',
          'Connect you with advisors and attorneys you choose to invite',
          'Analyze usage to improve the product',
          'Comply with legal obligations',
        ],
      },
      { kind: 'p', text: 'We do not:' },
      {
        kind: 'ul',
        items: [
          'Sell your personal information to third parties',
          'Use your financial data to train AI models',
          'Share your data with advertisers',
          'Use your data for purposes other than those listed above',
        ],
      },
    ],
  },
  {
    id: 'legal-basis',
    title: '4. LEGAL BASIS FOR PROCESSING (WASHINGTON WCPA)',
    blocks: [
      {
        kind: 'p',
        text: 'Under the Washington Consumer Protection Act (WCPA) and Washington My Health MY Data Act (MHMD), you have rights regarding your personal data. We process your data on the following bases:',
      },
      {
        kind: 'ul',
        items: [
          'Contract: to provide the services you signed up for',
          'Legal obligation: tax records, breach notification, billing compliance',
          'Legitimate interest: security monitoring, fraud prevention, product improvement',
          'Consent: marketing emails (you may withdraw consent at any time)',
        ],
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
        text: 'When you invite an advisor or attorney and they accept, they can view your household financial data within the platform. You control these connections and can revoke access at any time from your account settings.',
      },
      { kind: 'p', text: 'With service providers (data processors):' },
      {
        kind: 'ul',
        items: [
          'Supabase: database and authentication (data stored in the United States)',
          'Vercel: application hosting (United States)',
          'Stripe: payment processing (does not receive your financial planning data)',
          'Resend: transactional email delivery',
        ],
      },
      {
        kind: 'p',
        text: 'Each provider is bound by a Data Processing Agreement. We do not authorize them to use your data for their own purposes.',
      },
      { kind: 'p', text: 'We do not share your data with any other third parties except:' },
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
    title: '6. DATA RETENTION',
    blocks: [
      {
        kind: 'p',
        text: 'We retain your data for as long as your account is active. If you delete your account, we delete your personal data within 30 days, except where we are required to retain it by law (e.g. billing records for 7 years per IRS requirements).',
      },
      {
        kind: 'p',
        text: 'Anonymized, aggregated data (not linked to you) may be retained indefinitely for product improvement.',
      },
    ],
  },
  {
    id: 'your-rights',
    title: '7. YOUR RIGHTS (WASHINGTON WCPA)',
    blocks: [
      { kind: 'p', text: 'Washington residents have the right to:' },
      {
        kind: 'ul',
        items: [
          'Access: request a copy of the personal data we hold about you',
          'Correction: request correction of inaccurate data',
          'Deletion: request deletion of your personal data',
          'Portability: receive your data in a structured, machine-readable format',
          'Opt-out: opt out of the sale of personal data (we do not sell data)',
        ],
      },
      {
        kind: 'p',
        text: 'To exercise these rights, email privacy@mywealthmaps.com. We will respond within 45 days. We may need to verify your identity before processing requests.',
      },
      {
        kind: 'p',
        text: 'We will not discriminate against you for exercising your privacy rights.',
      },
    ],
  },
  {
    id: 'cookies',
    title: '8. COOKIES',
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
        text: 'We do not use advertising cookies or third-party tracking pixels. You can control cookies through your browser settings. Disabling cookies may prevent some features from working correctly.',
      },
    ],
  },
  {
    id: 'security',
    title: '9. SECURITY',
    blocks: [
      { kind: 'p', text: 'We implement the following security measures:' },
      {
        kind: 'ul',
        items: [
          'Encryption in transit: TLS 1.2+ on all connections',
          'Encryption at rest: AES-256 via Supabase (Postgres)',
          'Access controls: row-level security policies on all database tables',
          'Authentication: email verification, optional two-factor authentication',
          'Session management: short-lived tokens with automatic refresh',
        ],
      },
      {
        kind: 'p',
        text: 'No system is completely secure. If you believe your account has been compromised, contact security@mywealthmaps.com immediately.',
      },
    ],
  },
  {
    id: 'breach-notification',
    title: '10. DATA BREACH NOTIFICATION',
    blocks: [
      {
        kind: 'p',
        text: 'In the event of a data breach affecting your personal information, we will notify you within 30 days of discovery, as required by Washington RCW 19.255.010. If the breach affects more than 500 Washington residents, we will also notify the Washington Attorney General.',
      },
    ],
  },
  {
    id: 'children',
    title: "11. CHILDREN'S PRIVACY",
    blocks: [
      {
        kind: 'p',
        text: 'My Wealth Maps is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact privacy@mywealthmaps.com.',
      },
    ],
  },
  {
    id: 'changes',
    title: '12. CHANGES TO THIS POLICY',
    blocks: [
      {
        kind: 'p',
        text: 'We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice on the platform at least 30 days before the change takes effect. Your continued use of the platform after the effective date constitutes acceptance of the updated policy.',
      },
    ],
  },
  {
    id: 'contact',
    title: '13. CONTACT US',
    blocks: [
      { kind: 'p', text: 'Privacy questions: privacy@mywealthmaps.com' },
      { kind: 'p', text: 'Security concerns: security@mywealthmaps.com' },
      { kind: 'p', text: `Mailing address: ${COMPANY_ADDRESS}` },
      { kind: 'p', text: `Washington State registered agent: ${REGISTERED_AGENT}` },
    ],
  },
]
