export const WALK_LISTING_SOURCE = 'e2e_claim_walk'

export const DIRECTORY_CLAIM_WALK_FIXTURES = {
  attorney: {
    email: 'e2e-claim-walk-attorney@mywealthmaps.test',
    contact_name: 'E2E Claim Walk Attorney',
    firm_name: 'E2E Claim Walk Attorney PLLC',
    website: 'https://claimwalk-attorney.mywealthmaps.test',
    phone: '206-555-0101',
    city: 'Seattle',
    state: 'WA',
    bio: 'Staging walk fixture for directory claim.',
    specializations: ['Estate Planning'],
  },
  advisor: {
    email: 'e2e-claim-walk-advisor@mywealthmaps.test',
    contact_name: 'E2E Claim Walk Advisor',
    firm_name: 'E2E Claim Walk Advisory LLC',
    website: 'https://claimwalk-advisor.mywealthmaps.test',
    adv_link: 'https://claimwalk-advisor.mywealthmaps.test',
    phone: '206-555-0102',
    city: 'Seattle',
    state: 'WA',
    bio: 'Staging walk fixture for directory claim.',
    specializations: ['Financial Planning'],
  },
} as const

export type DirectoryClaimWalkKind = keyof typeof DIRECTORY_CLAIM_WALK_FIXTURES
