/**
 * Canonical E2E / Playwright test identities (go-live v2).
 *
 * All automation and seed scripts should import from here — not hardcode legacy
 * @rolobe.resend.app addresses. Retire via `npm run cleanup:purge` (go-live) or `npm run cleanup:rolobe` (legacy list).
 *
 * Domain: @mywealthmaps.test — does not receive real mail; safe for staging/prod smoke.
 */

import { ENVIRONMENTS, type TestEnv } from './testEnv'

export const E2E_TEST_PASSWORD = 'E2eTest!2026Mwm'

/** Default Playwright target — production (preview vercel.app POST /api/* may hang). */
export const E2E_DEFAULT_BASE_URL = 'https://www.mywealthmaps.com'

/** Drip smoke — capture via /assess or homepage; verify with verify-drip-sequence.ts */
export const DRIP_SMOKE_EMAIL = 'e2e-drip@mywealthmaps.test'

/** Production consumer canary — password from E2E_CANARY_PASSWORD at seed time */
export const PROD_CANARY = {
  email: 'canary-consumer@mywealthmaps.com',
  fullName: 'Canary Consumer',
  householdName: 'Canary Test Household',
} as const

/**
 * Production role canaries — login smoke only (no firm; use seed:prod-advisor-firm for Track 2).
 * Password: same E2E_CANARY_PASSWORD as consumer canary. Seed: npm run seed:prod-role-canaries -- --confirm
 */
export const PROD_ROLE_CANARIES = {
  advisor: {
    email: 'canary-advisor@mywealthmaps.com',
    fullName: 'Canary Advisor',
  },
  advisorEmpty: {
    email: 'canary-advisor-empty@mywealthmaps.com',
    fullName: 'Canary Empty Advisor',
  },
  attorney: {
    email: 'canary-attorney@mywealthmaps.com',
    fullName: 'Canary Attorney',
  },
  advisorClient: {
    email: 'canary-advisor-client@mywealthmaps.com',
    fullName: 'Canary Advisor Client',
    householdName: 'Canary Advisor Client Household',
  },
} as const

export const PROD_CANARY_EMAILS = [
  PROD_CANARY.email,
  PROD_ROLE_CANARIES.advisor.email,
  PROD_ROLE_CANARIES.advisorEmpty.email,
  PROD_ROLE_CANARIES.attorney.email,
  PROD_ROLE_CANARIES.advisorClient.email,
] as const

export const E2E_IDENTITIES = {
  consumer: {
    email: 'e2e-consumer@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Consumer',
    householdName: 'E2E Consumer Household',
  },
  /** Dedicated consumer for invite→accept link fixture — never linked in seed; link via Playwright setup. */
  consumerLinked: {
    email: 'e2e-consumer-linked@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Consumer Linked',
    householdName: 'E2E Consumer Linked Household',
  },
  /** Dedicated consumer for pending-link authz (5c) — never linked; 5c owns pending→active. */
  consumerPending: {
    email: 'e2e-consumer-pending@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Consumer Pending',
    householdName: 'E2E Consumer Pending Household',
  },
  consumerTier1: {
    email: 'e2e-consumer-tier1@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Consumer Tier1',
    householdName: 'E2E Tier1 Household',
  },
  /** Subscribe-then-cancel persona — has_ever_subscribed + canceled → effective tier 0 */
  consumerCanceled: {
    email: 'e2e-consumer-canceled@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Consumer Canceled',
    householdName: 'E2E Canceled Household',
  },
  /** App-managed trial — trial_ends_at set, has_ever_subscribed false → effective tier 3 */
  consumerAppTrial: {
    email: 'e2e-consumer-app-trial@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Consumer App Trial',
    householdName: 'E2E App Trial Household',
  },
  /** Active retirement tier — consumer_tier 2 + active sub */
  consumerTier2: {
    email: 'e2e-consumer-tier2@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Consumer Tier2',
    householdName: 'E2E Tier2 Household',
  },
  /** Plan & Export purchaser without active subscription — deliverable cell 3 */
  consumerPlanExport: {
    email: 'e2e-consumer-plan-export@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Consumer Plan Export',
    householdName: 'E2E Plan Export Household',
  },
  /** Stage 1 golden-path smoke — wizard done, 1 of 5 financial sections, tier 1 */
  goldenPathStage1: {
    email: 'e2e-golden-path@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Golden Path',
    householdName: 'E2E Golden Path Household',
  },
  advisor: {
    email: 'e2e-advisor@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Test Advisor',
    firmName: 'MWM E2E Advisory',
  },
  /** Dedicated advisor for pending-link authz (5c) — never shares sessions with read-only smokes. */
  advisorPending: {
    email: 'e2e-advisor-pending@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Advisor Pending',
    firmName: 'MWM E2E Pending Advisory',
  },
  /** Zero linked clients — playbook empty-state E2E; consumer link for pending recommendations. */
  advisorEmpty: {
    email: 'e2e-advisor-empty@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Empty Advisor',
    firmName: 'MWM E2E Empty Advisory',
  },
  /** Advisor-linked client — rich household for advisor workspace / RMD / domicile E2E */
  advisorClient: {
    email: 'e2e-advisor-client@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'Morgan Demo',
    householdName: 'E2E Advisor Client Household',
  },
  attorneyPortal: {
    email: 'e2e-attorney@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Test Attorney',
  },
  attorneyListing: {
    email: 'e2e-attorney-listing@mywealthmaps.test',
    contactName: 'E2E Attorney Listing',
    firmName: 'MWM E2E Law Group',
  },
  /** Staging-only — auth + is_superuser for /admin/preview; no household/estate data. */
  superuser: {
    email: 'e2e-superuser@mywealthmaps.test',
    password: E2E_TEST_PASSWORD,
    fullName: 'E2E Superuser',
  },
  advisorListing: {
    email: 'e2e-advisor-listing@mywealthmaps.test',
    contactName: 'E2E Advisor Listing',
    firmName: 'MWM E2E Advisory Group',
  },
} as const

/** Stable referral codes for ?ref= / ?aref= tests (set on directory rows by seed). */
export const E2E_REFERRAL_CODES = {
  advisor: 'e2eadv01',
  attorney: 'e2eatt01',
} as const

/** All @rolobe.resend.app accounts — delete only via cleanup-test-accounts.ts --rolobe */
export const ROLOBE_ACCOUNTS = [
  'consumer3@rolobe.resend.app',
  'consumer5@rolobe.resend.app',
  'consumer11@rolobe.resend.app',
  'consumer15@rolobe.resend.app',
  'consumer17@rolobe.resend.app',
  'consumer18@rolobe.resend.app',
  'consumer19@rolobe.resend.app',
  'consumer20@rolobe.resend.app',
  'consumer21@rolobe.resend.app',
  'advisor@rolobe.resend.app',
  'advisor2@rolobe.resend.app',
  'consumer1@rolobe.resend.app',
  'test-attorney-portal@rolobe.resend.app',
] as const

/** Retired pre-v2 identities (non-rolobe) — safe to delete with --legacy */
export const LEGACY_E2E_EMAILS = [
  'test-attorney@mywealthmaps.test',
  'test-advisor@mywealthmaps.test',
  'michael.johnson.demo@local.estate',
  'e2e-client.johnson@mywealthmaps.test',
] as const

export function buildEnvTestFileLines(opts: {
  testEnv: TestEnv
  householdId: string
  advisorClientHouseholdId?: string
  consumerLinkHouseholdId?: string
  advisorUserId?: string
  consumerLinkUserId?: string
  supabaseServiceRoleKey?: string
  supabaseAnonKey?: string
}): string {
  const targetFile = ENVIRONMENTS[opts.testEnv].envFile
  const lines = [
    `# Generated by: npx tsx scripts/seed-e2e-fixtures.ts`,
    `# Copy to ${targetFile} (gitignored). Do not commit secrets.`,
    `# baseURL: ${ENVIRONMENTS[opts.testEnv].baseURL}`,
    '',
    `TEST_ENV=${opts.testEnv}`,
    '',
    `PLAYWRIGHT_CONSUMER_EMAIL=${E2E_IDENTITIES.consumer.email}`,
    `PLAYWRIGHT_CONSUMER_PASSWORD=${E2E_IDENTITIES.consumer.password}`,
    `PLAYWRIGHT_HOUSEHOLD_ID=${opts.householdId}`,
    '',
    `PLAYWRIGHT_CONSUMER_LINK_EMAIL=${E2E_IDENTITIES.consumerLinked.email}`,
    `PLAYWRIGHT_CONSUMER_LINK_PASSWORD=${E2E_IDENTITIES.consumerLinked.password}`,
    `PLAYWRIGHT_ADVISOR_EMAIL=${E2E_IDENTITIES.advisor.email}`,
    `PLAYWRIGHT_ADVISOR_PASSWORD=${E2E_IDENTITIES.advisor.password}`,
    '',
    `PLAYWRIGHT_ADVISOR_EMPTY_EMAIL=${E2E_IDENTITIES.advisorEmpty.email}`,
    `PLAYWRIGHT_ADVISOR_EMPTY_PASSWORD=${E2E_IDENTITIES.advisorEmpty.password}`,
    '',
    `PLAYWRIGHT_ATTORNEY_EMAIL=${E2E_IDENTITIES.attorneyPortal.email}`,
    `PLAYWRIGHT_ATTORNEY_PASSWORD=${E2E_IDENTITIES.attorneyPortal.password}`,
    '',
    `PLAYWRIGHT_SUPERUSER_EMAIL=${E2E_IDENTITIES.superuser.email}`,
    `PLAYWRIGHT_SUPERUSER_PASSWORD=${E2E_IDENTITIES.superuser.password}`,
    '',
    `PLAYWRIGHT_CONSUMER_TIER1_EMAIL=${E2E_IDENTITIES.consumerTier1.email}`,
    `PLAYWRIGHT_CONSUMER_TIER1_PASSWORD=${E2E_IDENTITIES.consumerTier1.password}`,
    '',
    `PLAYWRIGHT_CONSUMER_APP_TRIAL_EMAIL=${E2E_IDENTITIES.consumerAppTrial.email}`,
    `PLAYWRIGHT_CONSUMER_APP_TRIAL_PASSWORD=${E2E_IDENTITIES.consumerAppTrial.password}`,
    '',
    `PLAYWRIGHT_CONSUMER_TIER2_EMAIL=${E2E_IDENTITIES.consumerTier2.email}`,
    `PLAYWRIGHT_CONSUMER_TIER2_PASSWORD=${E2E_IDENTITIES.consumerTier2.password}`,
    '',
    `PLAYWRIGHT_CONSUMER_PLAN_EXPORT_EMAIL=${E2E_IDENTITIES.consumerPlanExport.email}`,
    `PLAYWRIGHT_CONSUMER_PLAN_EXPORT_PASSWORD=${E2E_IDENTITIES.consumerPlanExport.password}`,
    '',
    `PLAYWRIGHT_ADVISOR_REFERRAL_CODE=${E2E_REFERRAL_CODES.advisor}`,
    `PLAYWRIGHT_ATTORNEY_REFERRAL_CODE=${E2E_REFERRAL_CODES.attorney}`,
    '',
    `SEED_ADVISOR_EMAIL=${E2E_IDENTITIES.advisor.email}`,
    `SEED_CLIENT_EMAIL=${E2E_IDENTITIES.advisorClient.email}`,
  ]
  if (opts.advisorClientHouseholdId) {
    lines.push(
      '',
      `PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID=${opts.advisorClientHouseholdId}`,
    )
  }
  if (opts.consumerLinkHouseholdId) {
    lines.push(
      '',
      `PLAYWRIGHT_CONSUMER_LINK_HOUSEHOLD_ID=${opts.consumerLinkHouseholdId}`,
    )
  }
  if (opts.advisorUserId) {
    lines.push('', `PLAYWRIGHT_ADVISOR_USER_ID=${opts.advisorUserId}`)
  }
  if (opts.consumerLinkUserId) {
    lines.push(`PLAYWRIGHT_CONSUMER_LINK_USER_ID=${opts.consumerLinkUserId}`)
  }
  if (opts.supabaseAnonKey) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    if (supabaseUrl) {
      lines.push('', `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`)
    }
    lines.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${opts.supabaseAnonKey}`)
  }
  if (opts.supabaseServiceRoleKey) {
    lines.push(`SUPABASE_SERVICE_ROLE_KEY=${opts.supabaseServiceRoleKey}`)
  }
  return lines.join('\n') + '\n'
}
