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
  [E2E_IDENTITIES.advisor.email, E2E_IDENTITIES.advisor.password],
  [E2E_IDENTITIES.advisorClient.email, E2E_IDENTITIES.advisorClient.password],
  [E2E_IDENTITIES.attorneyPortal.email, E2E_IDENTITIES.attorneyPortal.password],
].map(([email, password]) => [email.toLowerCase(), password] as const))

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
