import {
  TERMS_OF_SERVICE_VERSION,
  termsOfServiceSections,
} from '@/lib/legal/terms-of-service-sections'
import { flattenLegalSections, type AcceptTermsSection } from './flattenLegalSections'

/** Single source of truth for live ToS — all routes must use this, not app_config. */
export function getCanonicalTerms(): {
  version: string
  sections: AcceptTermsSection[]
} {
  return {
    version: TERMS_OF_SERVICE_VERSION,
    sections: flattenLegalSections(termsOfServiceSections),
  }
}
