import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminActionLogEntry = {
  action: string
  timestamp: string
  adminEmail?: string
  adminUserId?: string
  [key: string]: unknown
}

const ADMIN_USER_ACTIONS_KEY = 'admin_user_actions_log'
const MAX_ADMIN_ACTIONS = 100

export async function appendAdminUserActionLog(
  admin: SupabaseClient,
  entry: Omit<AdminActionLogEntry, 'timestamp'> & { timestamp?: string },
): Promise<void> {
  const { data: existing } = await admin
    .from('app_config')
    .select('value')
    .eq('key', ADMIN_USER_ACTIONS_KEY)
    .maybeSingle()

  const prior = Array.isArray(existing?.value) ? existing.value : []
  const next = [{ ...entry, timestamp: entry.timestamp ?? new Date().toISOString() }, ...prior].slice(
    0,
    MAX_ADMIN_ACTIONS,
  )

  await admin.from('app_config').upsert({
    key: ADMIN_USER_ACTIONS_KEY,
    value: next,
    description: 'Last 100 admin user support actions (tier override, Stripe sync, waitlist invite)',
  })
}

export async function getAdminActorEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  return profile?.email ?? userId
}
