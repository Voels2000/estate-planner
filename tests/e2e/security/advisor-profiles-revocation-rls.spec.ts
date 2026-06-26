/**
 * Post-revocation profiles RLS — advisor must not read ex-client profile via PostgREST
 * after consumer disconnect (status removed; ids retained).
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { createAdminClient } from '@/lib/supabase/admin'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'
import { resolveE2eEmail, resolveE2ePassword } from '../helpers/e2e-auth'

test.describe.configure({ mode: 'serial' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

let advisorClientUserId: string | null = null
let advisorClientLinkId: string | null = null
let savedLinkStatus: { status: string; client_status: string | null } | null = null

test.beforeAll(async ({}, testInfo) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    testInfo.skip(true, 'NEXT_PUBLIC_SUPABASE_* required')
    return
  }

  initSupabaseEnv()
  advisorClientUserId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)
  const advisorId = await findUserIdByEmail(E2E_IDENTITIES.advisor.email)
  if (!advisorClientUserId || !advisorId) {
    testInfo.skip(true, 'e2e advisor-client or advisor missing — run npm run seed:e2e')
    return
  }

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('advisor_clients')
    .select('id, status, client_status')
    .eq('advisor_id', advisorId)
    .eq('client_id', advisorClientUserId)
    .maybeSingle()

  advisorClientLinkId = link?.id ?? null
  savedLinkStatus = link
    ? { status: link.status, client_status: link.client_status ?? null }
    : null
})

test.afterAll(async () => {
  if (!advisorClientLinkId || !savedLinkStatus) return
  const admin = createAdminClient()
  await admin
    .from('advisor_clients')
    .update({
      status: savedLinkStatus.status,
      client_status: savedLinkStatus.client_status,
    })
    .eq('id', advisorClientLinkId)
})

test('advisor cannot SELECT ex-client profile after link revoked', async () => {
  test.skip(!advisorClientLinkId || !advisorClientUserId, 'advisor→client link missing')

  const admin = createAdminClient()
  const { error: revokeError } = await admin
    .from('advisor_clients')
    .update({ status: 'removed', client_status: 'inactive' })
    .eq('id', advisorClientLinkId!)
  expect(revokeError, revokeError?.message).toBeNull()

  const advisorEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_ADVISOR_EMAIL,
    E2E_IDENTITIES.advisor.email,
  )
  const advisorPassword = resolveE2ePassword(
    advisorEmail,
    process.env.PLAYWRIGHT_ADVISOR_PASSWORD,
  )

  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: signInError } = await client.auth.signInWithPassword({
    email: advisorEmail,
    password: advisorPassword,
  })
  expect(signInError, signInError?.message).toBeNull()

  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', advisorClientUserId!)
    .maybeSingle()

  if (error) {
    expect(error.message.toLowerCase()).toMatch(/permission|denied|not authorized|42501/)
    return
  }

  expect(data, 'revoked advisor must not read ex-client profile row').toBeNull()
})
