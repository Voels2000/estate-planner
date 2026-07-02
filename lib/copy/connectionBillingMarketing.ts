import { ATTORNEY_FREE_CLIENTS } from '@/lib/billing/attorneyBillableQuantity'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { formatBandRangeLabel } from '@/lib/billing/firmConnectionBillingSummary'
import {
  ADVISOR_BANDS,
  ATTORNEY_BANDS,
  type ConnectionBand,
} from '@/lib/pricing/connectionPricing'

export function formatConnectionBandTable(bands: ConnectionBand[]): string {
  return bands
    .map((band) => `$${band.rate}/client for ${formatBandRangeLabel(band)}`)
    .join('; ')
}

export function attorneyFreeClientMarketingLine(): string {
  return isConnectionBillingEnabled()
    ? 'Your first connected client is free'
    : 'Up to 3 client households on the free plan'
}

export function attorneyFreeClientIncludedLine(): string {
  return isConnectionBillingEnabled()
    ? '1 free client connection included'
    : '3 free client connections included'
}

export function attorneyOnboardingFreeClientLine(): string {
  return isConnectionBillingEnabled()
    ? 'Connect your first client at no cost'
    : 'Connect up to 3 clients at no cost'
}

export function pricingFaqAttorneyFreeLine(): string {
  return isConnectionBillingEnabled()
    ? 'Attorneys can start free — your first connected client is included at no cost.'
    : 'Attorneys can start free with up to 3 client households.'
}

export function pricingFaqAdvisorCoverageLine(): string {
  return isConnectionBillingEnabled()
    ? 'No. If your financial advisor invited you as a client, your access is covered under their firm — you get full Estate-tier access at no cost. Advisors pay per connected household, not per seat.'
    : 'No. If your financial advisor invited you as a client, your access is covered under their advisor seat — you get full Estate-tier access at no cost.'
}

export function connectionAttorneyPricingBlurb(): string {
  const bands = formatConnectionBandTable(ATTORNEY_BANDS)
  return `First client free, then ${bands}. No seats, no caps — you only pay for clients actually connected.`
}

export function connectionAdvisorPricingBlurb(): string {
  const bands = formatConnectionBandTable(ADVISOR_BANDS)
  return `${bands} per connected household. No per-seat fees — pricing scales with your actual client relationships.`
}

export function attorneyFreeTierFeatureLabel(): string {
  return isConnectionBillingEnabled()
    ? 'Your first connected client is free'
    : '3 client households'
}

export function freeAttorneyClientCapMessage(): string {
  return isConnectionBillingEnabled()
    ? `Free plan limited to ${ATTORNEY_FREE_CLIENTS} client household`
    : 'Free plan limited to 3 client households'
}
