/**
 * Project-level diagnostic: does this Supabase project let two concurrent sessions
 * for the SAME user coexist, or does logging in / refreshing one kill the other?
 *
 * Uses a throwaway user it creates and deletes — touches no real identity.
 * Emits exactly one verdict: SINGLE_SESSION | CROSS_REFRESH | INDEPENDENT.
 * Exits 0 on a clean run (diagnostic, not a gate); exits 2 if the probe cannot run.
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { initSupabaseEnv } from './seed-e2e-lib'

const tail = (t?: string | null) => (t ? t.slice(-8) : 'none')
const log = (k: string, o: Record<string, unknown>) => console.log(`${k} ${JSON.stringify(o)}`)
const verdict = (v: string, detail: Record<string, unknown>) =>
  log('ci-rotation-probe-verdict', { verdict: v, ...detail })

function authClient(supabaseUrl: string, anonKey: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function main() {
  initSupabaseEnv()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey || !serviceRole) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY required')
  }

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
  const email = `rotation-probe+${Date.now()}@example.test`
  const password = randomUUID()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(`createUser failed: ${createError?.message}`)
  }
  const userId = created.user.id

  try {
    const a = authClient(supabaseUrl, anonKey)
    const b = authClient(supabaseUrl, anonKey)

    const { data: aIn, error: aLoginError } = await a.auth.signInWithPassword({ email, password })
    if (aLoginError || !aIn.session) {
      throw new Error(`A login failed: ${aLoginError?.message}`)
    }
    const rtA0 = aIn.session.refresh_token

    const { data: bIn, error: bLoginError } = await b.auth.signInWithPassword({ email, password })
    if (bLoginError || !bIn.session) {
      throw new Error(`B login failed: ${bLoginError?.message}`)
    }
    const rtB0 = bIn.session.refresh_token

    log('ci-rotation-probe-sessions', {
      rtA0: tail(rtA0),
      rtB0: tail(rtB0),
      distinct: rtA0 !== rtB0,
    })

    const { data: aR1, error: aR1Error } = await a.auth.refreshSession({ refresh_token: rtA0 })
    if (aR1Error || !aR1.session) {
      verdict('SINGLE_SESSION', {
        meaning:
          "B's login invalidated A's session. Sequential same-user logins kill earlier sessions.",
        fix: 'Distinct user per concurrent job (not per-suite files of one user), or disable single-session in project Auth settings.',
        aRefreshErr: aR1Error?.message,
      })
      return
    }
    const rtA1 = aR1.session.refresh_token

    const { error: bRefreshError } = await b.auth.refreshSession({ refresh_token: rtB0 })
    if (bRefreshError) {
      log('ci-rotation-probe-note', { bRefreshErr: bRefreshError.message })
    }

    const { data: aR2, error: aR2Error } = await a.auth.refreshSession({ refresh_token: rtA1 })
    if (aR2Error || !aR2.session) {
      verdict('CROSS_REFRESH', {
        meaning: 'Concurrent sessions coexist at login, but refreshing one kills the others.',
        fix: 'Distinct user per concurrent job. Per-suite files of one user are NOT safe.',
        aRefreshErr: aR2Error?.message,
      })
      return
    }

    verdict('INDEPENDENT', {
      meaning:
        'Concurrent same-user sessions survive both login and refresh. Cross-session rotation is NOT the advisor cause — pivot to runtime re-auth or advisor-specific middleware.',
    })
  } finally {
    await admin.auth.admin.deleteUser(userId).catch((error) => {
      console.error(`ci-rotation-probe-cleanup-warn ${error?.message ?? error}`)
    })
  }
}

main().catch((error) => {
  console.error(`ci-rotation-probe-error ${error?.message ?? error}`)
  process.exit(2)
})
