import {
  TERMS_OF_SERVICE_VERSION,
  termsOfServiceSections,
} from '@/lib/legal/terms-of-service-sections'
import { flattenLegalSections, type AcceptTermsSection } from './flattenLegalSections'

export function getCanonicalTerms(): {
  version: string
  sections: AcceptTermsSection[]
} {
  return {
    version: TERMS_OF_SERVICE_VERSION,
    sections: flattenLegalSections(termsOfServiceSections),
  }
}
