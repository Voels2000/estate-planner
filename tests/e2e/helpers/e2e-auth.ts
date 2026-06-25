import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  E2E_IDENTITIES,
  E2E_TEST_PASSWORD,
} from '../../../scripts/e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'

const CANONICAL_BY_EMAIL = new Map<string, string>([
  [E2E_IDENTITIES.consumer.email, E2E_IDENTITIES.consumer.password],
  [E2E_IDENTITIES.consumerTier1.email, E2E_IDENTITIES.consumerTier1.password],
  [E2E_IDENTITIES.consumerCanceled.email, E2E_IDENTITIES.consumerCanceled.password],
  [E2E_IDENTITIES.advisor.email, E2E_IDENTITIES.advisor.password],
  [E2E_IDENTITIES.advisorClient.email, E2E_IDENTITIES.advisorClient.password],
  [E2E_IDENTITIES.attorneyPortal.email, E2E_IDENTITIES.attorneyPortal.password],
].map(([email, password]) => [email.toLowerCase(), password] as const))

/** Retired addresses → canonical @mywealthmaps.test (stale .env.test / shell exports). */
const LEGACY_EMAIL_MAP = new Map<string, string>([
  ['david@rolobe.resend.app', E2E_IDENTITIES.consumer.email],
  ['advisor2@rolobe.resend.app', E2E_IDENTITIES.advisor.email],
  ['consumer1@rolobe.resend.app', E2E_IDENTITIES.consumerTier1.email],
  ['advisor@rolobe.resend.app', E2E_IDENTITIES.advisor.email],
  ['test-attorney-portal@rolobe.resend.app', E2E_IDENTITIES.attorneyPortal.email],
  ['e2e-client.johnson@mywealthmaps.test', E2E_IDENTITIES.advisorClient.email],
  ['michael.johnson.demo@local.estate', E2E_IDENTITIES.advisorClient.email],
  ['test-advisor@mywealthmaps.test', E2E_IDENTITIES.advisor.email],
  ['test-attorney@mywealthmaps.test', E2E_IDENTITIES.attorneyPortal.email],
])

/** Tier-1 consumer credentials — prefers lean E2E_TIER1_* staging names. */
export function resolveTier1Credentials(): { email: string; password: string } {
  const email = resolveE2eEmail(
    process.env.E2E_TIER1_EMAIL ?? process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL,
    E2E_IDENTITIES.consumerTier1.email,
  )
  const password = resolveE2ePassword(
    email,
    process.env.E2E_TIER1_PASSWORD ?? process.env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD,
  )
  return { email, password }
}

/** Prefer canonical identity; remap retired rolobe / pre-v2 addresses from stale env. */
export function resolveE2eEmail(
  envEmail: string | undefined,
  canonicalEmail: string,
): string {
  const trimmed = envEmail?.trim()
  if (!trimmed) return canonicalEmail

  // Production smoke uses real canary / prod accounts — never remap to @mywealthmaps.test.
  if (process.env.TEST_ENV === 'production') {
    return trimmed
  }

  const mapped = LEGACY_EMAIL_MAP.get(trimmed.toLowerCase())
  if (mapped) {
    if (mapped !== trimmed) {
      console.warn(`[e2e] Remapping retired email ${trimmed} → ${mapped}`)
    }
    return mapped
  }

  if (trimmed.toLowerCase().endsWith('@rolobe.resend.app')) {
    console.warn(
      `[e2e] Ignoring retired rolobe email ${trimmed}; using ${canonicalEmail}`,
    )
    return canonicalEmail
  }

  if (!trimmed.toLowerCase().endsWith('@mywealthmaps.test')) {
    console.warn(
      `[e2e] Non-canonical E2E email ${trimmed}; using ${canonicalEmail}`,
    )
    return canonicalEmail
  }

  return trimmed
}

/** Canonical password for known e2e emails; otherwise env or default. */
export function resolveE2ePassword(email: string, envPassword?: string): string {
  return CANONICAL_BY_EMAIL.get(email.toLowerCase()) ?? envPassword ?? E2E_TEST_PASSWORD
}

function requireSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (url) return url
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL missing from .env.test. Re-run npm run seed:e2e and copy the printed block.',
  )
}

/** Reset Auth password to match canonical e2e password (requires service role in .env.test). */
export async function syncE2ePasswordForEmail(email: string, password: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return
  }
  initSupabaseEnv()
  requireSupabaseUrl()
  const userId = await findUserIdByEmail(email)
  if (!userId) {
    throw new Error(
      `E2E user ${email} not found in Supabase Auth. Run: npm run seed:e2e (with .env.local)`,
    )
  }
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password })
  if (error) throw new Error(`Failed to sync password for ${email}: ${error.message}`)
}

/** Verify credentials against Supabase Auth (same project as NEXT_PUBLIC_SUPABASE_URL). */
export async function verifyE2eSignIn(email: string, password: string): Promise<void> {
  const url = requireSupabaseUrl()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY missing from .env.test')
  }
  const { error } = await createClient(url, anon).auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Supabase sign-in failed for ${email}: ${error.message}`)
}
