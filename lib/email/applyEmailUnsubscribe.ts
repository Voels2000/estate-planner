import type { SupabaseClient } from '@supabase/supabase-js'

export type EmailUnsubscribeType = 'advisor' | 'attorney' | 'capture'

export type EmailUnsubscribeUpdate = {
  table: 'profiles' | 'email_captures'
  column: 'advisor_drip_unsubscribed_at' | 'attorney_drip_unsubscribed_at' | 'unsubscribed_at'
  email: string
}

/** Parse ?type= — absent means waitlist/capture; unknown values are rejected. */
export function parseEmailUnsubscribeType(
  typeParam: string | null,
): EmailUnsubscribeType | 'invalid' {
  if (typeParam === null) return 'capture'
  if (typeParam === 'advisor' || typeParam === 'attorney') return typeParam
  return 'invalid'
}

export function emailUnsubscribeUpdateTarget(
  type: EmailUnsubscribeType,
  email: string,
): EmailUnsubscribeUpdate {
  const normalized = email.trim().toLowerCase()
  if (type === 'advisor') {
    return {
      table: 'profiles',
      column: 'advisor_drip_unsubscribed_at',
      email: normalized,
    }
  }
  if (type === 'attorney') {
    return {
      table: 'profiles',
      column: 'attorney_drip_unsubscribed_at',
      email: normalized,
    }
  }
  return {
    table: 'email_captures',
    column: 'unsubscribed_at',
    email: normalized,
  }
}

export async function applyEmailUnsubscribe(
  admin: SupabaseClient,
  type: EmailUnsubscribeType,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = emailUnsubscribeUpdateTarget(type, email)
  const now = new Date().toISOString()

  const { error } = await admin
    .from(target.table)
    .update({ [target.column]: now })
    .eq('email', target.email)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
