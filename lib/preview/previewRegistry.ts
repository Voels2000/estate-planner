import { BillingClient } from '@/app/billing/_billing-client'
import { FirmBillingClient } from '@/app/billing/_firm-billing-client'
import { AttorneyBillingClient } from '@/app/(attorney)/attorney/billing/_attorney-billing-client'
import {
  AdvisorManagedBillingBlock,
  AdvisorMemberBillingBlock,
} from '@/lib/preview/components/BillingRouteMessages'
import {
  fxAdvisorLinkedClient,
  fxAdvisorOwnerActive,
  fxAdvisorOwnerSubscribe,
  fxAttorneyPlans,
  fxConsumerEstate,
  fxConsumerEstateActive,
  fxConsumerTier1,
} from '@/lib/preview/fixtures/billing'
import type { PreviewScreen } from '@/lib/preview/types'

export const previewRegistry: PreviewScreen[] = [
  {
    id: 'billing',
    label: 'Billing',
    variants: [
      {
        id: 'consumer-estate',
        label: 'Consumer — Estate (gold)',
        component: BillingClient,
        fixture: fxConsumerEstate,
      },
      {
        id: 'consumer-tier1',
        label: 'Consumer — tier 1',
        component: BillingClient,
        fixture: fxConsumerTier1,
      },
      {
        id: 'consumer-estate-active',
        label: 'Consumer — Estate active',
        component: BillingClient,
        fixture: fxConsumerEstateActive,
      },
      {
        id: 'advisor-owner-active',
        label: 'Advisor — firm owner (active)',
        component: FirmBillingClient,
        fixture: fxAdvisorOwnerActive,
      },
      {
        id: 'advisor-owner-subscribe',
        label: 'Advisor — firm owner (subscribe)',
        component: FirmBillingClient,
        fixture: fxAdvisorOwnerSubscribe,
      },
      {
        id: 'advisor-member',
        label: 'Advisor — firm member',
        component: AdvisorMemberBillingBlock,
        fixture: {},
      },
      {
        id: 'managed-client',
        label: 'Managed client (advisor-linked)',
        component: BillingClient,
        fixture: fxAdvisorLinkedClient,
      },
      {
        id: 'advisor-managed',
        label: 'Advisor-managed subscription',
        component: AdvisorManagedBillingBlock,
        fixture: {},
      },
      {
        id: 'attorney-plans',
        label: 'Attorney — plan picker',
        component: AttorneyBillingClient,
        fixture: fxAttorneyPlans,
      },
    ],
  },
]
