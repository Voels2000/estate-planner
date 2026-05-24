import type { Metadata } from 'next'
import { LegalDocumentLayout } from '@/components/legal/LegalDocumentLayout'
import {
  PRIVACY_POLICY_LAST_UPDATED,
  privacyPolicySections,
} from '@/lib/legal/privacy-policy-sections'

export const metadata: Metadata = {
  title: 'Privacy Policy | My Wealth Maps',
  description: 'Privacy Policy for My Wealth Maps — Washington WCPA compliant.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      lastUpdated={PRIVACY_POLICY_LAST_UPDATED}
      sections={privacyPolicySections}
    />
  )
}
