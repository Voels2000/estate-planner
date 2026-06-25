/**
 * Tier-restructure E2E persona matrix — each row is the only seed coverage for a resolver branch.
 * `npm run seed:e2e` must satisfy every row; `verifyE2ePersonaMatrix` asserts post-seed state.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { PLAN_AND_EXPORT_SKU } from '../lib/billing/stripePrices'
import { E2E_IDENTITIES } from './e2e-test-identities'

export type TrialEndsAtExpectation = 'null' | 'future'

export type E2ePersonaExpectation = {
  /** Stable key for tests and logs */
  branch: string
  email: string
  consumer_tier: number
  subscription_status: string
  has_ever_subscribed: boolean
  trial_ends_at: TrialEndsAtExpectation
  /** When true, user must have a completed plan_and_export one_time_purchases row */
  plan_export_purchase?: boolean
}

/** Resolver / deliverable branches that must not lose seed coverage during consolidation. */
export const E2E_PERSONA_MATRIX: readonly E2ePersonaExpectation[] = [
  {
    branch: 'tier-0-canceled-has_ever_subscribed',
    email: E2E_IDENTITIES.consumerCanceled.email,
    consumer_tier: 0,
    subscription_status: 'canceled',
    has_ever_subscribed: true,
    trial_ends_at: 'null',
  },
  {
    branch: 'app-managed-trial',
    email: E2E_IDENTITIES.consumerAppTrial.email,
    consumer_tier: 0,
    subscription_status: 'none',
    has_ever_subscribed: false,
    trial_ends_at: 'future',
  },
  {
    branch: 'active-tier-1',
    email: E2E_IDENTITIES.consumerTier1.email,
    consumer_tier: 1,
    subscription_status: 'active',
    has_ever_subscribed: true,
    trial_ends_at: 'null',
  },
  {
    branch: 'active-tier-2',
    email: E2E_IDENTITIES.consumerTier2.email,
    consumer_tier: 2,
    subscription_status: 'active',
    has_ever_subscribed: true,
    trial_ends_at: 'null',
  },
  {
    branch: 'active-tier-3',
    email: E2E_IDENTITIES.consumer.email,
    consumer_tier: 3,
    subscription_status: 'active',
    has_ever_subscribed: true,
    trial_ends_at: 'null',
  },
  {
    branch: 'plan-export-purchaser-no-sub',
    email: E2E_IDENTITIES.consumerPlanExport.email,
    consumer_tier: 1,
    subscription_status: 'none',
    has_ever_subscribed: false,
    trial_ends_at: 'null',
    plan_export_purchase: true,
  },
] as const

/** Refreshed on every `seed:e2e` — ~2y horizon so staging gaps never expire the fixture mid-suite. */
export const E2E_APP_TRIAL_WINDOW_MS = 730 * 24 * 60 * 60 * 1000

export function e2eAppTrialEndsAtIso(from: Date = new Date()): string {
  return new Date(from.getTime() + E2E_APP_TRIAL_WINDOW_MS).toISOString()
}

export type PersonaMatrixVerifyResult = {
  notSeeded: { branch: string; email: string }[]
  mismatches: string[]
  queryErrors: string[]
}

export function personaMatrixHasIssues(result: PersonaMatrixVerifyResult): boolean {
  return (
    result.notSeeded.length > 0 ||
    result.mismatches.length > 0 ||
    result.queryErrors.length > 0
  )
}

export function isPersonaMatrixNotSeededOnly(result: PersonaMatrixVerifyResult): boolean {
  return (
    result.notSeeded.length > 0 &&
    result.mismatches.length === 0 &&
    result.queryErrors.length === 0
  )
}

export function formatPersonaMatrixNotSeededMessage(result: PersonaMatrixVerifyResult): string {
  const lines = [
    '',
    'E2E persona matrix: identities not seeded yet (not a resolver bug).',
    'Run: npm run seed:e2e',
    '  or: npm run seed:e2e:persona-matrix   # consumer matrix only',
    '',
    'Missing:',
    ...result.notSeeded.map((r) => `  - ${r.email} (${r.branch})`),
    '',
  ]
  return lines.join('\n')
}

export async function verifyE2ePersonaMatrix(admin: SupabaseClient): Promise<PersonaMatrixVerifyResult> {
  const notSeeded: PersonaMatrixVerifyResult['notSeeded'] = []
  const mismatches: string[] = []
  const queryErrors: string[] = []
  const now = Date.now()

  for (const row of E2E_PERSONA_MATRIX) {
    const { data: profile, error } = await admin
      .from('profiles')
      .select(
        'id, email, consumer_tier, subscription_status, has_ever_subscribed, trial_ends_at',
      )
      .eq('email', row.email)
      .maybeSingle()

    if (error) {
      queryErrors.push(`${row.branch}: profile query failed — ${error.message}`)
      continue
    }
    if (!profile?.id) {
      notSeeded.push({ branch: row.branch, email: row.email })
      continue
    }

    if (profile.consumer_tier !== row.consumer_tier) {
      mismatches.push(
        `${row.branch}: consumer_tier ${profile.consumer_tier} (expected ${row.consumer_tier})`,
      )
    }
    if (profile.subscription_status !== row.subscription_status) {
      mismatches.push(
        `${row.branch}: subscription_status ${profile.subscription_status} (expected ${row.subscription_status})`,
      )
    }
    if (profile.has_ever_subscribed !== row.has_ever_subscribed) {
      mismatches.push(
        `${row.branch}: has_ever_subscribed ${profile.has_ever_subscribed} (expected ${row.has_ever_subscribed})`,
      )
    }

    if (row.trial_ends_at === 'null') {
      if (profile.trial_ends_at != null) {
        mismatches.push(`${row.branch}: trial_ends_at should be null, got ${profile.trial_ends_at}`)
      }
    } else {
      if (!profile.trial_ends_at) {
        mismatches.push(`${row.branch}: trial_ends_at must be set (app-managed trial window)`)
      } else if (new Date(profile.trial_ends_at).getTime() <= now) {
        mismatches.push(`${row.branch}: trial_ends_at ${profile.trial_ends_at} is not in the future`)
      }
    }

    if (row.plan_export_purchase) {
      const { count, error: purchaseErr } = await admin
        .from('one_time_purchases')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('sku', PLAN_AND_EXPORT_SKU)
        .eq('status', 'completed')

      if (purchaseErr) {
        queryErrors.push(`${row.branch}: one_time_purchases query failed — ${purchaseErr.message}`)
      } else if (!count || count < 1) {
        mismatches.push(`${row.branch}: expected completed plan_and_export purchase row`)
      }
    }
  }

  return { notSeeded, mismatches, queryErrors }
}

/** Flat issue list for callers that expect legacy string[] (e.g. post-seed hard assert). */
export async function verifyE2ePersonaMatrixIssues(admin: SupabaseClient): Promise<string[]> {
  const result = await verifyE2ePersonaMatrix(admin)
  return [
    ...result.queryErrors,
    ...result.notSeeded.map((r) => `${r.branch}: missing profile for ${r.email}`),
    ...result.mismatches,
  ]
}
