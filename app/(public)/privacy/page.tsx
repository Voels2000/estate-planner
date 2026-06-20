import type { Metadata } from 'next'
import { LegalDocumentLayout } from '@/components/legal/LegalDocumentLayout'
import { privacyPolicyAddenda } from '@/lib/legal/privacy-policy-addenda'
import {
  PRIVACY_POLICY_LAST_UPDATED,
  privacyPolicySections,
} from '@/lib/legal/privacy-policy-sections'

export const metadata: Metadata = {
  title: 'Privacy Policy | My Wealth Maps',
  description:
    'Privacy Policy for My Wealth Maps — U.S. privacy rights for all residents.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      lastUpdated={PRIVACY_POLICY_LAST_UPDATED}
      sections={[...privacyPolicySections, ...privacyPolicyAddenda]}
    />
  )
}
