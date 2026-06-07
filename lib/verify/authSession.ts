import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function projectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split('.')[0] ?? 'local'
}

export function authCookieHeader(
  supabaseUrl: string,
  session: {
    access_token: string
    refresh_token: string
    expires_at?: number
    expires_in?: number
    token_type: string
    user: unknown
  },
): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64')
  return `sb-${projectRef(supabaseUrl)}-auth-token=base64-${payload}`
}

/** Magic-link session for HTTP verification (service role + anon key required). */
export async function createUserSessionForEmail(
  admin: SupabaseClient,
  supabaseUrl: string,
  anonKey: string,
  email: string,
) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`generateLink failed: ${linkErr?.message ?? 'no token'}`)
  }

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })
  if (error || !data.session) {
    throw new Error(`verifyOtp failed: ${error?.message ?? 'no session'}`)
  }
  return data.session
}
