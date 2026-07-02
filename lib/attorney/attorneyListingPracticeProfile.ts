import type { SupabaseClient } from '@supabase/supabase-js'
import { attorneyConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import { attorneyProjectedBillableAfterConnect } from '@/lib/billing/attorneyBillableQuantity'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import {
  ATTORNEY_PRACTICE_PROFILE_FIELD_COUNT,
  normalizeAttorneyCredentials,
  normalizeAttorneyFeeStructure,
  normalizeAttorneySpecializations,
  normalizeLicensedStates,
} from '@/lib/attorney/attorneyPracticeOptions'
import { wouldConnectAddBillableAttorneyHousehold } from '@/lib/billing/attorneyConnectionBilling'

export type AttorneyPracticeProfileRow = {
  states_licensed: string[] | null
  specializations: string[] | null
  credentials: string[] | null
  fee_structure: string | null
}

export type PracticeProfileMissingField =
  | 'states_licensed'
  | 'specializations'
  | 'credentials'
  | 'fee_structure'

const PAID_CONSUMER_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'canceling'])

export function isConsumerDirectPaidSubscriber(
  subscriptionStatus: string | null | undefined,
): boolean {
  const status = subscriptionStatus ?? 'none'
  return PAID_CONSUMER_SUBSCRIPTION_STATUSES.has(status)
}

export function attorneyPracticeProfileMissingFields(
  listing: AttorneyPracticeProfileRow,
): PracticeProfileMissingField[] {
  const states = normalizeLicensedStates(listing.states_licensed)
  const specs = normalizeAttorneySpecializations(listing.specializations)
  const creds = normalizeAttorneyCredentials(listing.credentials)
  const fee = normalizeAttorneyFeeStructure(listing.fee_structure)

  const missing: PracticeProfileMissingField[] = []
  if (states.length === 0) missing.push('states_licensed')
  if (specs.length === 0) missing.push('specializations')
  if (creds.length === 0) missing.push('credentials')
  if (!fee) missing.push('fee_structure')
  return missing
}

export function isAttorneyPracticeProfileComplete(listing: AttorneyPracticeProfileRow): boolean {
  return attorneyPracticeProfileMissingFields(listing).length === 0
}

export function attorneyPracticeProfileCompletedCount(listing: AttorneyPracticeProfileRow): number {
  return ATTORNEY_PRACTICE_PROFILE_FIELD_COUNT - attorneyPracticeProfileMissingFields(listing).length
}

export type PracticeProfileGateBlock = {
  ok: false
  status: 403
  body: {
    error: string
    practice_profile_required: true
    missing: PracticeProfileMissingField[]
    settings_path: '/attorney/settings'
  }
}

export type PracticeProfileGateOk = { ok: true }

export type PracticeProfileGateResult = PracticeProfileGateOk | PracticeProfileGateBlock

export function practiceProfileGateErrorMessage(missing: PracticeProfileMissingField[]): string {
  if (missing.length === 0) {
    return 'Complete your practice profile in Firm settings before connecting paid clients.'
  }
  const labels: Record<PracticeProfileMissingField, string> = {
    states_licensed: 'at least one licensed state',
    specializations: 'at least one practice area',
    credentials: 'at least one credential',
    fee_structure: 'fee structure',
  }
  const parts = missing.map((f) => labels[f])
  return `Complete your practice profile (${parts.join(', ')}) in Firm settings before connecting paid clients.`
}

/**
 * True when this connect path should require a complete practice & credentials profile:
 * - Consumer pays their own subscription, or
 * - Connection billing is on and this household would be billable (after the one free client).
 */
export async function requiresAttorneyPracticeProfileForConnect(
  admin: SupabaseClient,
  listingId: string,
  householdId: string,
  consumerSubscriptionStatus?: string | null,
): Promise<boolean> {
  if (isConsumerDirectPaidSubscriber(consumerSubscriptionStatus)) {
    return true
  }

  if (!isConnectionBillingEnabled()) {
    return false
  }

  const addsNew = await wouldConnectAddBillableAttorneyHousehold(admin, listingId, householdId)
  if (!addsNew) return false

  const connected = await attorneyConnectedHouseholds(admin, listingId)
  return attorneyProjectedBillableAfterConnect(connected) > 0
}

export async function assertAttorneyPracticeProfileForPaidConsumerConnect(
  admin: SupabaseClient,
  opts: {
    listingId: string
    householdId: string
    consumerSubscriptionStatus?: string | null
  },
): Promise<PracticeProfileGateResult> {
  const needsProfile = await requiresAttorneyPracticeProfileForConnect(
    admin,
    opts.listingId,
    opts.householdId,
    opts.consumerSubscriptionStatus,
  )
  if (!needsProfile) return { ok: true }

  const { data: listing, error } = await admin
    .from('attorney_listings')
    .select('states_licensed, specializations, credentials, fee_structure')
    .eq('id', opts.listingId)
    .single<AttorneyPracticeProfileRow>()

  if (error || !listing) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Attorney listing not found',
        practice_profile_required: true,
        missing: ['states_licensed', 'specializations', 'credentials', 'fee_structure'],
        settings_path: '/attorney/settings',
      },
    }
  }

  const missing = attorneyPracticeProfileMissingFields(listing)
  if (missing.length === 0) return { ok: true }

  return {
    ok: false,
    status: 403,
    body: {
      error: practiceProfileGateErrorMessage(missing),
      practice_profile_required: true,
      missing,
      settings_path: '/attorney/settings',
    },
  }
}

/** Consumer-facing copy when attorney listing blocks a paid connect. */
export function consumerAttorneyPracticeProfileBlockedMessage(): string {
  return 'This attorney must complete their practice profile before you can connect. Try again later or choose another attorney.'
}
