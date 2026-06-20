import type { LegalSection } from '@/components/legal/LegalDocumentLayout'
import { COMPANY_ADDRESS, COMPANY_LEGAL_NAME } from '@/lib/legal/company'

/** State-specific addenda — appended after the main Privacy Policy body. */
export const privacyPolicyAddenda: LegalSection[] = [
  {
    id: 'addendum-intro',
    title: 'STATE-SPECIFIC ADDENDA',
    blocks: [
      {
        kind: 'p',
        text: 'The privacy rights in Section 7 apply to all United States residents. The addenda below provide additional disclosures required or customary in certain states. They do not limit the rights granted in the main Policy.',
      },
    ],
  },
  {
    id: 'addendum-california',
    title: 'Addendum A — California (CCPA/CPRA)',
    blocks: [
      {
        kind: 'p',
        text: 'Notice at Collection: The categories of personal information we collect and the purposes for which we use them are described in Sections 2 and 3 of this Policy.',
      },
      {
        kind: 'p',
        text: 'We do not sell or share personal information, and we do not use sensitive personal information beyond what is necessary to provide the Service.',
      },
      {
        kind: 'p',
        text: 'California residents may exercise the rights in Section 7, including opt-out of sale or sharing (though we do not sell or share), via the in-app form or privacy@mywealthmaps.com. Universal opt-out signals such as Global Privacy Control are described in Section 11 — we do not sell or share personal information, so no additional opt-out action is required.',
      },
      {
        kind: 'p',
        text: 'We will not discriminate against you for exercising your privacy rights. California residents may use an authorized agent to submit a request; we may require proof of authorization and may require you to verify your identity directly.',
      },
      {
        kind: 'p',
        text: 'Shine the Light: California Civil Code § 1798.83 permits California residents to request certain information regarding disclosure of personal information to third parties for direct marketing. We do not disclose personal information to third parties for their direct marketing purposes.',
      },
    ],
  },
  {
    id: 'addendum-virginia-model',
    title: 'Addendum B — Colorado, Connecticut, Oregon, Texas, and Similar Laws',
    blocks: [
      {
        kind: 'p',
        text: 'Residents of states with comprehensive privacy laws (including Colorado, Connecticut, Oregon, Texas, Virginia, and others with similar frameworks) have the access, correction, deletion, portability, opt-out, and appeal rights described in Sections 7 and 8. We detect universal opt-out signals such as Global Privacy Control as described in Section 11. We do not sell personal data or use it for targeted advertising.',
      },
    ],
  },
  {
    id: 'addendum-minors',
    title: 'Addendum C — Minors (13–17)',
    blocks: [
      {
        kind: 'p',
        text: 'The Service is intended only for adults 18 and older. Where applicable state law restricts the sale of personal data or targeted advertising relating to consumers aged 13–17, we do not engage in such processing because we do not sell data or use it for targeted advertising.',
      },
    ],
  },
  {
    id: 'addendum-washington',
    title: 'Addendum D — Washington State',
    blocks: [
      {
        kind: 'p',
        text: 'Automatic renewal: Washington RCW 19.316 subscription disclosures appear in our Terms of Service (Section 5.2) and in pre-checkout and pricing-page billing disclosures.',
      },
      {
        kind: 'p',
        text: 'Data breach notification: Washington RCW 19.255.010 requirements are described in Section 10 of this Policy.',
      },
      {
        kind: 'p',
        text: `Consumer health data: ${COMPANY_LEGAL_NAME} provides estate and financial planning tools. We do not collect consumer health data as defined under Washington's My Health My Data Act unless you voluntarily enter health-adjacent information in free-text fields. If our data practices change, we will publish a separate Consumer Health Data Privacy Policy and obtain any required consent before collecting consumer health data.`,
      },
      {
        kind: 'p',
        text: `Washington registered agent: ${COMPANY_ADDRESS}.`,
      },
    ],
  },
]
