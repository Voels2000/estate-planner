/**
 * Mint per-suite Playwright storage states via independent API sessions.
 *
 * Browser signInWithPassword for the same user revokes prior refresh tokens during
 * prepare; magic-link sessions stay concurrent so each suite job keeps its own token.
 */
import { mkdirSync, writeFileSync } from 'fs'
import { E2E_IDENTITIES } from './e2e-test-identities'
import { createE2eAuthSessionForEmail, initSupabaseEnv } from './seed-e2e-lib'
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

async function mintStorageState(path: string, email: string): Promise<void> {
  const { session, supabaseUrl } = await createE2eAuthSessionForEmail(email)
  mkdirSync('.auth', { recursive: true })
  writeFileSync(path, JSON.stringify(playwrightStorageState(supabaseUrl, session), null, 2))
  writeAuthExpirySidecar(path)
  console.log(`Minted ${path}`)
}

async function main() {
  initSupabaseEnv()

  await mintStorageState(
    '.auth/consumer.go-live-profile.json',
    E2E_IDENTITIES.consumer.email,
  )
  await mintStorageState(
    '.auth/consumer.security-smoke.json',
    E2E_IDENTITIES.consumer.email,
  )
  await mintStorageState('.auth/advisor.security-smoke.json', E2E_IDENTITIES.advisor.email)
  await mintStorageState('.auth/consumer.b4-gate.json', E2E_IDENTITIES.consumer.email)
  await mintStorageState('.auth/advisor.b4-gate.json', E2E_IDENTITIES.advisor.email)
  await mintStorageState(
    '.auth/consumer.security-isolation.json',
    E2E_IDENTITIES.consumer.email,
  )
  await mintStorageState(
    '.auth/advisor.security-isolation.json',
    E2E_IDENTITIES.advisor.email,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
