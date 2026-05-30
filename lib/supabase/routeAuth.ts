import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * API route auth — prefer getSession() over getUser() to avoid a Supabase round-trip
 * on every request (getUser() can hang or slow cold serverless on Vercel).
 */
export async function getRouteAuth(): Promise<{
  supabase: SupabaseClient
  user: User | null
}> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return { supabase, user: session?.user ?? null }
}
