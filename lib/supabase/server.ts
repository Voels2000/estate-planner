import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, UserResponse } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isEmailConfirmed } from '@/lib/auth/emailConfirmation'

/** Strip sessions for users who have not confirmed email (defense in depth vs direct sign-in). */
function applyEmailConfirmGate(client: SupabaseClient): SupabaseClient {
  const auth = client.auth
  const getUser = auth.getUser.bind(auth)
  const getSession = auth.getSession.bind(auth)

  auth.getUser = (async (...args: Parameters<typeof getUser>) => {
    const result = await getUser(...args)
    if (result.data.user && !isEmailConfirmed(result.data.user)) {
      return { data: { user: null }, error: null } as unknown as UserResponse
    }
    return result
  }) as typeof getUser

  auth.getSession = (async (...args: Parameters<typeof getSession>) => {
    const result = await getSession(...args)
    if (result.data.session?.user && !isEmailConfirmed(result.data.session.user)) {
      return { data: { session: null }, error: null } as unknown as Awaited<
        ReturnType<typeof getSession>
      >
    }
    return result
  }) as typeof getSession

  return client
}

export async function createClient() {
  const cookieStore = await cookies()

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in Server Components — middleware refreshes the session
          }
        },
      },
    }
  )

  return applyEmailConfirmGate(client)
}

/** Cookie-writable Supabase client for Server Actions (e.g. /auth/confirm verifyOtp). */
export async function createServerActionClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}
