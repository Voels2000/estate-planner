import type { LegalSection } from '@/components/legal/LegalDocumentLayout'
import { COMPANY_ADDRESS, COMPANY_LEGAL_NAME } from '@/lib/legal/company'

/** ISO date — stored on profiles.terms_version and app_config.terms_version */
export const TERMS_OF_SERVICE_VERSION = '2026-06-02'

export const TERMS_OF_SERVICE_LAST_UPDATED = 'June 2, 2026'

export const termsOfServiceSections: LegalSection[] = [
  {
    id: 'acceptance',
    title: '1. ACCEPTANCE OF TERMS',
    blocks: [
      {
        kind: 'p',
        text: 'By creating an account or using My Wealth Maps ("the Service"), you agree to these Terms of Service ("Terms"). If you do not agree, do not use the Service.',
      },
      {
        kind: 'p',
        text: `These Terms form a binding agreement between you and ${COMPANY_LEGAL_NAME}, a Washington State company ("My Wealth Maps," "we," "us," or "our").`,
      },
    ],
  },
  {
    id: 'description',
    title: '2. DESCRIPTION OF SERVICE',
    blocks: [
      {
        kind: 'p',
        text: 'My Wealth Maps provides financial planning preparation tools that help you organize household financial information, run planning calculations, and prepare for conversations with qualified financial and legal professionals.',
      },
      {
        kind: 'p',
        text: 'The Service is not financial advice, investment advice, tax advice, or legal advice. Nothing on the platform creates an adviser-client, attorney-client, or fiduciary relationship between you and My Wealth Maps. Always consult qualified professionals before making financial or legal decisions.',
      },
    ],
  },
  {
    id: 'eligibility',
    title: '3. ELIGIBILITY',
    blocks: [
      {
        kind: 'p',
        text: 'You must be at least 18 years old and a United States resident to use the Service. By using the Service, you represent that you meet these requirements.',
      },
    ],
  },
  {
    id: 'accounts',
    title: '4. ACCOUNTS',
    blocks: [
      {
        kind: 'p',
        text: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately at security@mywealthmaps.com if you suspect unauthorized access.',
      },
      {
        kind: 'p',
        text: 'You may not share your account, create accounts for others without their consent, or use the Service for any unlawful purpose.',
      },
    ],
  },
  {
    id: 'subscription',
    title: '5. SUBSCRIPTION AND BILLING',
    blocks: [
      {
        kind: 'p',
        text: '5.1 Plans and Pricing\nMy Wealth Maps offers subscription plans as described at mywealthmaps.com/pricing. Prices are in US dollars.',
      },
      {
        kind: 'p',
        text: '5.2 Automatic Renewal (Washington RCW 19.316)\nYOUR SUBSCRIPTION RENEWS AUTOMATICALLY. At the end of each billing period, your subscription will automatically renew at the then-current price unless you cancel before the renewal date. We will send you a reminder email at least 7 days before each renewal.',
      },
      {
        kind: 'p',
        text: '5.3 Cancellation\nYou may cancel your subscription at any time from your account settings at mywealthmaps.com/billing. Cancellation takes effect at the end of the current billing period. You will retain access to paid features through that date.',
      },
      {
        kind: 'p',
        text: '5.4 Refunds\nWe do not offer refunds for partial billing periods. If you cancel, you retain access through the end of your paid period. Exceptions may be made at our discretion for billing errors — contact support@mywealthmaps.com.',
      },
      {
        kind: 'p',
        text: '5.5 Price Changes\nWe will notify you at least 30 days before any price increase. Continued use after the effective date constitutes acceptance of the new price.',
      },
    ],
  },
  {
    id: 'acceptable-use',
    title: '6. ACCEPTABLE USE',
    blocks: [
      { kind: 'p', text: 'You agree not to:' },
      {
        kind: 'ul',
        items: [
          'Use the Service for any unlawful purpose',
          'Attempt to gain unauthorized access to any part of the Service',
          'Reverse engineer, decompile, or extract source code from the Service',
          'Upload malicious code or interfere with the Service\'s operation',
          'Use the Service to store or transmit data you do not have the right to use',
          'Misrepresent your identity or affiliation',
        ],
      },
    ],
  },
  {
    id: 'your-data',
    title: '7. YOUR DATA',
    blocks: [
      {
        kind: 'p',
        text: 'You own the financial data you enter into My Wealth Maps. By using the Service, you grant us a limited license to store, process, and display your data solely to provide the Service to you.',
      },
      {
        kind: 'p',
        text: 'We will not sell your data, use it to train AI models, or share it with third parties except as described in our Privacy Policy.',
      },
    ],
  },
  {
    id: 'advisor-connections',
    title: '8. ADVISOR AND ATTORNEY CONNECTIONS',
    blocks: [
      { kind: 'p', text: 'If you connect a financial advisor or estate attorney through the platform:' },
      {
        kind: 'ul',
        items: [
          'The connection is initiated by you and can be revoked at any time',
          'Connected professionals can view your household data within the platform',
          'My Wealth Maps is not responsible for advice given by connected professionals',
          'Connecting an attorney through the platform does not create an attorney-client relationship without a separate engagement letter',
        ],
      },
    ],
  },
  {
    id: 'intellectual-property',
    title: '9. INTELLECTUAL PROPERTY',
    blocks: [
      {
        kind: 'p',
        text: `The Service, including its software, design, and content, is owned by ${COMPANY_LEGAL_NAME} and protected by copyright and other intellectual property laws. You may not copy, modify, or distribute any part of the Service without our written permission.`,
      },
      {
        kind: 'p',
        text: 'Your data remains yours. These Terms do not transfer any intellectual property rights in your financial data to My Wealth Maps.',
      },
    ],
  },
  {
    id: 'disclaimers',
    title: '10. DISCLAIMERS',
    blocks: [
      {
        kind: 'p',
        text: `THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY LAW, ${COMPANY_LEGAL_NAME.toUpperCase()} DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.`,
      },
      {
        kind: 'p',
        text: 'CALCULATIONS AND PROJECTIONS PROVIDED BY THE SERVICE ARE ESTIMATES BASED ON INFORMATION YOU ENTER. THEY ARE NOT GUARANTEES OF FUTURE RESULTS AND SHOULD NOT BE RELIED UPON AS PROFESSIONAL FINANCIAL, TAX, OR LEGAL ADVICE.',
      },
    ],
  },
  {
    id: 'limitation-of-liability',
    title: '11. LIMITATION OF LIABILITY',
    blocks: [
      {
        kind: 'p',
        text: `TO THE FULLEST EXTENT PERMITTED BY LAW, ${COMPANY_LEGAL_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.`,
      },
      {
        kind: 'p',
        text: 'OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.',
      },
    ],
  },
  {
    id: 'indemnification',
    title: '12. INDEMNIFICATION',
    blocks: [
      {
        kind: 'p',
        text: `You agree to indemnify and hold harmless ${COMPANY_LEGAL_NAME} and its officers, directors, employees, and agents from any claims, damages, or expenses (including reasonable attorneys' fees) arising from your use of the Service or violation of these Terms.`,
      },
    ],
  },
  {
    id: 'dispute-resolution',
    title: '13. DISPUTE RESOLUTION',
    blocks: [
      {
        kind: 'p',
        text: '13.1 Informal Resolution\nBefore filing any legal claim, you agree to contact us at legal@mywealthmaps.com and attempt to resolve the dispute informally for at least 30 days.',
      },
      {
        kind: 'p',
        text: '13.2 Arbitration\nIf informal resolution fails, disputes shall be resolved by binding arbitration under the American Arbitration Association\'s Consumer Arbitration Rules, conducted in King County, Washington.',
      },
      {
        kind: 'p',
        text: `13.3 Class Action Waiver\nYOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION AGAINST ${COMPANY_LEGAL_NAME.toUpperCase()}.`,
      },
      {
        kind: 'p',
        text: '13.4 Governing Law\nThese Terms are governed by the laws of the State of Washington, without regard to conflict of law principles.',
      },
    ],
  },
  {
    id: 'termination',
    title: '14. TERMINATION',
    blocks: [
      {
        kind: 'p',
        text: 'We may suspend or terminate your account for violation of these Terms, non-payment, or any reason with 30 days notice. You may terminate your account at any time by cancelling your subscription and deleting your account from account settings.',
      },
      {
        kind: 'p',
        text: 'Upon termination, your data will be deleted within 30 days of account closure (end of your current billing period), per our Privacy Policy.',
      },
    ],
  },
  {
    id: 'changes-to-terms',
    title: '15. CHANGES TO TERMS',
    blocks: [
      {
        kind: 'p',
        text: 'We may update these Terms. We will notify you of material changes by email at least 30 days before the effective date. Continued use after the effective date constitutes acceptance.',
      },
    ],
  },
  {
    id: 'contact',
    title: '16. CONTACT',
    blocks: [
      { kind: 'p', text: 'Legal: legal@mywealthmaps.com' },
      { kind: 'p', text: 'Support: support@mywealthmaps.com' },
      { kind: 'p', text: `Mailing: ${COMPANY_ADDRESS}` },
    ],
  },
]
