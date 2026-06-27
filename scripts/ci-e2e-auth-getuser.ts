/**
 * Server-side getUser() checks for CI auth storage files.
 * Does NOT call refreshSession() — that would rotate the refresh token on the server
 * and invalidate the token shipped in the prepare tarball.
 */
import { createClient } from '@supabase/supabase-js'
import {
  parseSessionFromStorageState,
  refreshTokenSuffix,
} from '../tests/e2e/helpers/e2e-auth-session'

export type StorageStateGetUserCheck = {
  path: string
  role: 'advisor' | 'consumer'
  refreshSuffix: string
  userId?: string
  getUserOk: boolean
  getUserError?: string
  emailConfirmedAt?: string | null
}

export async function checkStorageStateGetUser(
  path: string,
  role: 'advisor' | 'consumer',
): Promise<StorageStateGetUserCheck> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required')
  }

  const session = parseSessionFromStorageState(path)
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: setError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (setError) {
    return {
      path,
      role,
      refreshSuffix: refreshTokenSuffix(session.refresh_token),
      userId: session.user_id,
      getUserOk: false,
      getUserError: `setSession: ${setError.message}`,
    }
  }

  const { data: userData, error: getUserError } = await client.auth.getUser()
  return {
    path,
    role,
    refreshSuffix: refreshTokenSuffix(session.refresh_token),
    userId: userData.user?.id ?? session.user_id,
    getUserOk: !getUserError && Boolean(userData.user),
    getUserError: getUserError?.message,
    emailConfirmedAt: userData.user?.email_confirmed_at ?? null,
  }
}

export function findDuplicateRefreshTokens(paths: readonly string[]): string[] {
  const byToken = new Map<string, string[]>()
  for (const path of paths) {
    const { refresh_token } = parseSessionFromStorageState(path)
    const existing = byToken.get(refresh_token) ?? []
    existing.push(path)
    byToken.set(refresh_token, existing)
  }
  return [...byToken.values()].filter((group) => group.length > 1).flat()
}

/** Log getUser health for advisor files after each mint — detects mint-order poisoning. */
export async function logAdvisorGetUserSnapshot(
  label: string,
  paths: readonly string[],
): Promise<void> {
  const checks = await Promise.all(paths.map((path) => checkStorageStateGetUser(path, 'advisor')))
  console.log(
    JSON.stringify({
      diag: 'ci-auth-mint-getuser-snapshot',
      label,
      checks: checks.map(({ path, refreshSuffix, getUserOk, getUserError }) => ({
        path,
        refreshSuffix,
        getUserOk,
        getUserError,
      })),
    }),
  )
}
