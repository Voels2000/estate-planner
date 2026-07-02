import {
  attorneyFreeTierFeatureLabel,
  connectionAdvisorPricingBlurb,
  connectionAttorneyPricingBlurb,
} from '@/lib/copy/connectionBillingMarketing'
import { ATTORNEY_FREE_CLIENTS } from '@/lib/billing/attorneyBillableQuantity'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import {
  advisorConnectionCheckoutPriceId,
  LEGACY_FIRM_CHECKOUT_QUANTITY_MAX,
} from '@/lib/billing/resolveAdvisorFirmCheckout'
import { attorneyConnectionCheckoutPriceId } from '@/lib/billing/resolveAttorneyCheckout'
import { formatBandRangeLabel } from '@/lib/billing/firmConnectionBillingSummary'
import {
  ADVISOR_BANDS,
  ATTORNEY_BANDS,
  type ConnectionBand,
} from '@/lib/pricing/connectionPricing'
import {
  ADVISOR_FIRM_PRICE_IDS,
  ADVISOR_FIRM_SEAT_RATES,
  ADVISOR_FIRM_SEAT_RANGES,
  ATTORNEY_PLAN_LIMITS,
  type AttorneyPlanKey,
} from '@/lib/tiers'

export type LegacyPublicAdvisorPlan = {
  mode: 'legacy'
  name: string
  seatRate: number
  range: string
  priceId: string
  minSeats: number
  maxSeats: number
  popular: boolean
  isEnterprise: boolean
  features: string[]
}

export type ConnectionPublicAdvisorPlan = {
  mode: 'connection'
  name: string
  ratePerClient: number
  rangeLabel: string
  priceId: string
  minClients: number
  maxClients: number
  popular: boolean
  isEnterprise: boolean
  features: string[]
}

export type PublicAdvisorPlan = LegacyPublicAdvisorPlan | ConnectionPublicAdvisorPlan

export type LegacyPublicAttorneyPlan = {
  mode: 'legacy'
  name: string
  price: number
  clientCap: number
  planKey?: AttorneyPlanKey
  popular: boolean
  features: string[]
}

export type ConnectionPublicAttorneyPlan = {
  mode: 'connection'
  name: string
  price: number
  clientCap: number
  ratePerClient?: number
  rangeLabel?: string
  minClients?: number
  maxClients?: number
  checkoutPriceId?: string
  popular: boolean
  isEnterprise: boolean
  features: string[]
}

export type PublicAttorneyPlan = LegacyPublicAttorneyPlan | ConnectionPublicAttorneyPlan

const LEGACY_ADVISOR_FEATURES: Record<string, string[]> = {
  Starter: [
    'Up to 10 advisor seats',
    'All consumer Estate features per client',
    'Strategy recommendation workflow',
    'Meeting brief PDF exports',
    'Client invite portal',
    'Advisor directory listing',
    'Firm branding',
  ],
  Growth: [
    'Up to 50 advisor seats',
    'Everything in Starter',
    'Bulk client import',
    'Custom PDF branding',
    'Priority support',
    'Advisor activation playbook',
  ],
  Enterprise: [
    '51+ advisor seats',
    'Everything in Growth',
    'White-label option',
    'Dedicated onboarding',
    'API access (roadmap)',
    'SSO / SAML (roadmap)',
  ],
}

function connectionAdvisorFeatures(band: ConnectionBand): string[] {
  const cap = Number.isFinite(band.hi) ? `Up to ${band.hi} connected clients` : '151+ connected clients'
  return [
    cap,
    'Per connected household — not per advisor seat',
    'All consumer Estate features per client',
    'Strategy recommendation workflow',
    'Meeting brief PDF exports',
    'Advisor directory listing',
  ]
}

function connectionAttorneyFeatures(band: ConnectionBand): string[] {
  const cap = Number.isFinite(band.hi)
    ? `Up to ${band.hi} client households`
    : '151+ client households'
  return [
    cap,
    'Per connected household billing',
    'Consumer-approved read access',
    'Attorney directory listing',
    'Document gap visibility',
  ]
}

function bandMaxClients(band: ConnectionBand): number {
  return Number.isFinite(band.hi) ? band.hi : LEGACY_FIRM_CHECKOUT_QUANTITY_MAX
}

export function getPublicAdvisorPricingSubtitle(): string {
  return isConnectionBillingEnabled()
    ? connectionAdvisorPricingBlurb()
    : 'Per-seat pricing. Connected clients get full Estate-tier access — no separate consumer subscription needed.'
}

export function getPublicAttorneyPricingSubtitle(): string {
  return isConnectionBillingEnabled()
    ? connectionAttorneyPricingBlurb()
    : 'Read access and document tools. Flat monthly fee — no per-client billing. Clients control what you can see.'
}

export function getPublicAdvisorPlans(): PublicAdvisorPlan[] {
  if (isConnectionBillingEnabled()) {
    const priceId = advisorConnectionCheckoutPriceId()
    return ADVISOR_BANDS.map((band) => ({
      mode: 'connection' as const,
      name: band.label,
      ratePerClient: band.rate,
      rangeLabel: formatBandRangeLabel(band),
      priceId,
      minClients: band.lo,
      maxClients: bandMaxClients(band),
      popular: band.label === 'Growth',
      isEnterprise: !Number.isFinite(band.hi),
      features: connectionAdvisorFeatures(band),
    }))
  }

  return [
    {
      mode: 'legacy',
      name: 'Starter',
      seatRate: ADVISOR_FIRM_SEAT_RATES.starter,
      range: ADVISOR_FIRM_SEAT_RANGES.starter.label,
      priceId: ADVISOR_FIRM_PRICE_IDS.starter,
      minSeats: ADVISOR_FIRM_SEAT_RANGES.starter.min,
      maxSeats: ADVISOR_FIRM_SEAT_RANGES.starter.max ?? 10,
      popular: false,
      isEnterprise: false,
      features: LEGACY_ADVISOR_FEATURES.Starter,
    },
    {
      mode: 'legacy',
      name: 'Growth',
      seatRate: ADVISOR_FIRM_SEAT_RATES.growth,
      range: ADVISOR_FIRM_SEAT_RANGES.growth.label,
      priceId: ADVISOR_FIRM_PRICE_IDS.growth,
      minSeats: ADVISOR_FIRM_SEAT_RANGES.growth.min,
      maxSeats: ADVISOR_FIRM_SEAT_RANGES.growth.max ?? 50,
      popular: true,
      isEnterprise: false,
      features: LEGACY_ADVISOR_FEATURES.Growth,
    },
    {
      mode: 'legacy',
      name: 'Enterprise',
      seatRate: ADVISOR_FIRM_SEAT_RATES.enterprise,
      range: ADVISOR_FIRM_SEAT_RANGES.enterprise.label,
      priceId: ADVISOR_FIRM_PRICE_IDS.enterprise,
      minSeats: ADVISOR_FIRM_SEAT_RANGES.enterprise.min,
      maxSeats: LEGACY_FIRM_CHECKOUT_QUANTITY_MAX,
      popular: false,
      isEnterprise: true,
      features: LEGACY_ADVISOR_FEATURES.Enterprise,
    },
  ]
}

export function getPublicAttorneyPlans(): PublicAttorneyPlan[] {
  if (isConnectionBillingEnabled()) {
    const priceId = attorneyConnectionCheckoutPriceId()
    return [
      {
        mode: 'connection',
        name: 'Free',
        price: 0,
        clientCap: ATTORNEY_FREE_CLIENTS,
        popular: false,
        isEnterprise: false,
        features: [
          attorneyFreeTierFeatureLabel(),
          'Consumer-approved read access',
          'Attorney directory listing',
          'Document gap visibility',
        ],
      },
      ...ATTORNEY_BANDS.map((band) => ({
        mode: 'connection' as const,
        name: band.label,
        price: band.rate,
        clientCap: bandMaxClients(band),
        ratePerClient: band.rate,
        rangeLabel: formatBandRangeLabel(band),
        minClients: band.lo,
        maxClients: bandMaxClients(band),
        popular: band.label === 'Starter',
        isEnterprise: !Number.isFinite(band.hi),
        features: connectionAttorneyFeatures(band),
        checkoutPriceId: priceId,
      })),
    ]
  }

  return [
    {
      mode: 'legacy',
      name: 'Free',
      price: 0,
      clientCap: 3,
      popular: false,
      features: [
        '3 client households',
        'Consumer-approved read access',
        'Attorney directory listing',
        'Document gap visibility',
      ],
    },
    {
      mode: 'legacy',
      name: 'Starter',
      planKey: 'starter',
      price: ATTORNEY_PLAN_LIMITS.starter.priceMonthly,
      clientCap: ATTORNEY_PLAN_LIMITS.starter.clientCap,
      popular: true,
      features: [
        '15 client households',
        'Everything in Free',
        'Document upload to client repository',
        'Weekly client digest emails',
        'Annual review due alerts',
        'Stale matter alerts (30-day)',
      ],
    },
    {
      mode: 'legacy',
      name: 'Growth',
      planKey: 'growth',
      price: ATTORNEY_PLAN_LIMITS.growth.priceMonthly,
      clientCap: ATTORNEY_PLAN_LIMITS.growth.clientCap,
      popular: false,
      features: [
        '50 client households',
        'Everything in Starter',
        'Priority support',
      ],
    },
  ]
}
