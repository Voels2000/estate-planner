import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PROFILE_FOR_ACCESS_SELECT,
  type ProfileForAccess,
} from '@/lib/access/buildUserAccessFromProfile'
import { ProfileAccessError } from '@/lib/access/profileAccessError'

/**
 * Load profiles row for tier resolution.
 *
 * Uses `.maybeSingle()` so a missing row (`data: null`, no error) is distinct from a
 * genuine read failure (`error` set). On read error we throw — we must NOT default to
 * tier 0, which would silently downgrade paying users when schema/env is wrong.
 * Do not wrap this in try/catch that returns a default tier at call sites.
 */
export async function loadProfileForUserAccess(
  admin: SupabaseClient,
  userId: string,
): Promise<ProfileForAccess | null> {
  const { data, error } = await admin
    .from('profiles')
    .select(PROFILE_FOR_ACCESS_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    const accessError = new ProfileAccessError(
      `Profile read failed for user ${userId}; refusing to infer tier`,
      { cause: error },
    )
    Sentry.captureException(accessError, {
      extra: { code: error.code, message: error.message, details: error.details },
    })
    throw accessError
  }

  return data
}
