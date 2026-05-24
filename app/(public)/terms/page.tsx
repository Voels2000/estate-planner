import type { Metadata } from 'next'
import { LegalDocumentLayout } from '@/components/legal/LegalDocumentLayout'
import {
  TERMS_OF_SERVICE_LAST_UPDATED,
  termsOfServiceSections,
} from '@/lib/legal/terms-of-service-sections'

export const metadata: Metadata = {
  title: 'Terms of Service | My Wealth Maps',
  description: 'Terms of Service for My Wealth Maps — Washington law, RCW 19.316 billing terms.',
}

export default function TermsOfServicePage() {
  return (
    <LegalDocumentLayout
      title="Terms of Service"
      lastUpdated={TERMS_OF_SERVICE_LAST_UPDATED}
      sections={termsOfServiceSections}
    />
  )
}
