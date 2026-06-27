/**
 * Mint per-suite Playwright storage states via independent API sessions.
 *
 * Each signInWithPassword creates a concurrent session (separate refresh token) so
 * parallel suite jobs never share or revoke one another's tokens.
 */
import { mkdirSync, writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { E2E_IDENTITIES } from './e2e-test-identities'
import { initSupabaseEnv } from './seed-e2e-lib'
import { writeAuthExpirySidecar } from '../tests/e2e/helpers/e2e-auth-session'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

function supabaseProjectRef(url: string): string {
  return new URL(url).hostname.split('.')[0] ?? 'local'
}

function playwrightStorageState(
  supabaseUrl: string,
  session: {
    access_token: string
    refresh_token: string
    expires_at?: number
    expires_in?: number
    token_type: string
    user: unknown
  },
) {
  const hostname = new URL(BASE_URL).hostname
  const cookieName = `sb-${supabaseProjectRef(supabaseUrl)}-auth-token`
  const payload = Buffer.from(JSON.stringify(session)).toString('base64')
  return {
    cookies: [
      {
        name: cookieName,
        value: `base64-${payload}`,
        domain: hostname,
        path: '/',
        expires: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  }
}

async function mintStorageState(path: string, email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required')
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`signInWithPassword ${email}: ${error?.message ?? 'no session'}`)
  }

  mkdirSync('.auth', { recursive: true })
  writeFileSync(path, JSON.stringify(playwrightStorageState(supabaseUrl, data.session), null, 2))
  writeAuthExpirySidecar(path)
  console.log(`Minted ${path}`)
}

async function main() {
  initSupabaseEnv()

  const consumer = E2E_IDENTITIES.consumer
  const advisor = E2E_IDENTITIES.advisor

  await mintStorageState('.auth/consumer.go-live-profile.json', consumer.email, consumer.password)
  await mintStorageState('.auth/consumer.security-smoke.json', consumer.email, consumer.password)
  await mintStorageState('.auth/advisor.security-smoke.json', advisor.email, advisor.password)
  await mintStorageState('.auth/consumer.b4-gate.json', consumer.email, consumer.password)
  await mintStorageState('.auth/advisor.b4-gate.json', advisor.email, advisor.password)
  await mintStorageState(
    '.auth/consumer.security-isolation.json',
    consumer.email,
    consumer.password,
  )
  await mintStorageState(
    '.auth/advisor.security-isolation.json',
    advisor.email,
    advisor.password,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
