/** Event slugs that surface the Washington estate tax contextual callout. */
export const WA_ESTATE_TAX_EVENT_SLUGS = [
  'death-of-spouse',
  'receiving-inheritance',
  'approaching-retirement',
  'selling-a-business',
] as const

export type WaEstateTaxEventSlug = (typeof WA_ESTATE_TAX_EVENT_SLUGS)[number]

export function shouldShowWaEstateTaxCallout(slug: string): slug is WaEstateTaxEventSlug {
  return (WA_ESTATE_TAX_EVENT_SLUGS as readonly string[]).includes(slug)
}

export const WA_ESTATE_TAX_GUIDE_PATH = '/learn/washington-estate-tax'

export const WA_ESTATE_TAX_SEO = {
  title: 'Washington State Estate Tax 2026 | WA Exemption & Bypass Trust Guide',
  description:
    'Washington state estate tax 2026 explained: the $3M WA estate tax exemption, graduated rates up to 20%, and how a bypass trust Washington couples use to shelter $6M estates. For advisors, attorneys, and families.',
} as const
