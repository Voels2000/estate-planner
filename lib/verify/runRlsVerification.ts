import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { HOUSEHOLD_SCOPED_RLS_SPOT_CHECK } from '@/lib/authz/householdScopedTables'
import { E2E_IDENTITIES } from '@/scripts/e2e-test-identities'
import { createAdminClient } from '@/lib/supabase/admin'
import { findUserIdByEmail, initSupabaseEnv } from '@/scripts/seed-e2e-lib'

export type RlsCheck = { id: string; pass: boolean; detail: string }

const INVARIANTS_SQL_PATH = join(process.cwd(), 'scripts/verify-rls-invariants.sql')

export type RunRlsVerificationOptions = {
  dbUrl?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  supabaseServiceKey?: string
  consumerEmail?: string
  consumerPassword?: string
  requireSql?: boolean
  skipBehavioral?: boolean
}

function resolveDbUrl(): string | undefined {
  return process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL
}

export async function runSqlRlsInvariants(dbUrl: string): Promise<RlsCheck[]> {
  const sql = readFileSync(INVARIANTS_SQL_PATH, 'utf8')
  const db = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 15 })

  try {
    const rows = await db.unsafe<
      Array<{ check_id: string; detail: string }>
    >(sql)

    if (rows.length === 0) {
      return [{ id: 'sql_invariants', pass: true, detail: 'All RLS SQL invariants passed (0 failures)' }]
    }

    const grouped = rows.reduce<Record<string, string[]>>((acc, row) => {
      const list = acc[row.check_id] ?? []
      list.push(row.detail)
      acc[row.check_id] = list
      return acc
    }, {})

    return Object.entries(grouped).map(([id, details]) => ({
      id,
      pass: false,
      detail: details.slice(0, 8).join('; ') + (details.length > 8 ? ` (+${details.length - 8} more)` : ''),
    }))
  } finally {
    await db.end({ timeout: 5 })
  }
}

async function fetchHouseholdIdByOwnerEmail(email: string): Promise<string | null> {
  initSupabaseEnv()
  const ownerId = await findUserIdByEmail(email)
  if (!ownerId) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data?.id ?? null
}

export async function runBehavioralRlsChecks(options: {
  supabaseUrl: string
  supabaseAnonKey: string
  consumerEmail: string
  consumerPassword: string
}): Promise<RlsCheck[]> {
  const consumerHouseholdId = await fetchHouseholdIdByOwnerEmail(options.consumerEmail)
  const foreignHouseholdId = await fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.advisorClient.email)

  if (!consumerHouseholdId || !foreignHouseholdId) {
    return [
      {
        id: 'behavioral_setup',
        pass: false,
        detail:
          'Missing E2E household IDs — run npm run seed:e2e on target Supabase before verify:rls',
      },
    ]
  }

  if (consumerHouseholdId === foreignHouseholdId) {
    return [
      {
        id: 'behavioral_setup',
        pass: false,
        detail: 'E2E consumer and advisor-client households must differ for isolation check',
      },
    ]
  }

  const userClient = createClient(options.supabaseUrl, options.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: options.consumerEmail,
    password: options.consumerPassword,
  })

  if (signInError) {
    return [
      {
        id: 'behavioral_sign_in',
        pass: false,
        detail: `Consumer sign-in failed: ${signInError.message}`,
      },
    ]
  }

  const admin = createAdminClient()

  const { data: foreignHousehold } = await admin
    .from('households')
    .select('owner_id')
    .eq('id', foreignHouseholdId)
    .maybeSingle()

  const foreignOwnerId = foreignHousehold?.owner_id
  if (!foreignOwnerId) {
    return [
      {
        id: 'behavioral_setup',
        pass: false,
        detail: `Could not resolve owner_id for foreign household ${foreignHouseholdId}`,
      },
    ]
  }

  const { count: foreignAssetCount } = await admin
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', foreignOwnerId)

  const { data: leakedAssets, error: assetsError } = await userClient
    .from('assets')
    .select('id')
    .eq('owner_id', foreignOwnerId)
    .limit(5)

  if (assetsError) {
    return [
      {
        id: 'behavioral_foreign_assets',
        pass: true,
        detail: `Foreign household assets query denied (${assetsError.message})`,
      },
    ]
  }

  const leakCount = leakedAssets?.length ?? 0
  const foreignCount = foreignAssetCount ?? 0

  const { data: leakedViewRows, error: viewError } = await userClient
    .from('lifetime_exemption_summary')
    .select('household_id')
    .limit(5)

  const viewDenied =
    Boolean(viewError) ||
    (leakedViewRows?.length ?? 0) === 0

  const anonClient = createClient(options.supabaseUrl, options.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: anonViewRows, error: anonViewError } = await anonClient
    .from('lifetime_exemption_summary')
    .select('household_id')
    .limit(5)

  const anonViewDenied =
    Boolean(anonViewError) ||
    (anonViewRows?.length ?? 0) === 0

  const householdTableChecks: RlsCheck[] = []
  for (const table of HOUSEHOLD_SCOPED_RLS_SPOT_CHECK) {
    const { data, error } = await userClient
      .from(table)
      .select('household_id')
      .eq('household_id', foreignHouseholdId)
      .limit(5)

    if (error) {
      householdTableChecks.push({
        id: `behavioral_household_${table}`,
        pass: true,
        detail: `Consumer JWT denied on foreign ${table} (${error.message})`,
      })
      continue
    }

    const leakCount = data?.length ?? 0
    householdTableChecks.push({
      id: `behavioral_household_${table}`,
      pass: leakCount === 0,
      detail:
        leakCount === 0
          ? `Consumer JWT: 0 rows on foreign household in ${table}`
          : `RLS leak: consumer read ${leakCount} row(s) from ${table} on household ${foreignHouseholdId}`,
    })
  }

  return [
    {
      id: 'behavioral_foreign_assets',
      pass: leakCount === 0,
      detail:
        leakCount === 0
          ? `Consumer JWT cannot read advisor-client assets (foreign rows exist: ${foreignCount})`
          : `RLS leak: consumer read ${leakCount} asset row(s) on foreign household ${foreignHouseholdId}`,
    },
    {
      id: 'behavioral_lifetime_exemption_view_auth',
      pass: viewDenied,
      detail: viewError
        ? `Authenticated client denied on lifetime_exemption_summary (${viewError.message})`
        : leakedViewRows?.length
          ? `RLS leak: authenticated read ${leakedViewRows.length} row(s) from lifetime_exemption_summary`
          : 'Authenticated client cannot read lifetime_exemption_summary (0 rows)',
    },
    {
      id: 'behavioral_lifetime_exemption_view_anon',
      pass: anonViewDenied,
      detail: anonViewError
        ? `Anon client denied on lifetime_exemption_summary (${anonViewError.message})`
        : anonViewRows?.length
          ? `RLS leak: anon read ${anonViewRows.length} row(s) from lifetime_exemption_summary`
          : 'Anon client cannot read lifetime_exemption_summary (0 rows)',
    },
    {
      id: 'behavioral_own_household',
      pass: true,
      detail: `Consumer household ${consumerHouseholdId} configured for isolation baseline`,
    },
    ...householdTableChecks,
  ]
}

export async function runRlsVerification(
  options: RunRlsVerificationOptions = {},
): Promise<RlsCheck[]> {
  const checks: RlsCheck[] = []
  const dbUrl = options.dbUrl ?? resolveDbUrl()
  const requireSql = options.requireSql ?? process.env.RLS_VERIFY_REQUIRE_SQL === 'true'

  if (dbUrl) {
    checks.push(...(await runSqlRlsInvariants(dbUrl)))
  } else if (requireSql) {
    checks.push({
      id: 'sql_invariants',
      pass: false,
      detail: 'SUPABASE_DB_URL or DATABASE_URL required for SQL RLS invariants',
    })
  } else {
    checks.push({
      id: 'sql_invariants',
      pass: true,
      detail: 'Skipped — set SUPABASE_DB_URL or DATABASE_URL to run SQL invariants',
    })
  }

  if (options.skipBehavioral) {
    checks.push({
      id: 'behavioral_isolation',
      pass: true,
      detail: 'Skipped (--skip-behavioral)',
    })
    return checks
  }

  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = options.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const consumerEmail =
    options.consumerEmail ??
    process.env.PLAYWRIGHT_CONSUMER_EMAIL ??
    E2E_IDENTITIES.consumer.email
  const consumerPassword =
    options.consumerPassword ??
    process.env.PLAYWRIGHT_CONSUMER_PASSWORD ??
    E2E_IDENTITIES.consumer.password

  if (!supabaseUrl || !supabaseAnonKey) {
    checks.push({
      id: 'behavioral_isolation',
      pass: requireSql ? true : false,
      detail: requireSql
        ? 'Skipped — missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY for JWT isolation check'
        : 'Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY for JWT isolation check',
    })
    return checks
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    checks.push({
      id: 'behavioral_setup',
      pass: false,
      detail: 'Missing SUPABASE_SERVICE_ROLE_KEY for household lookup',
    })
    return checks
  }

  checks.push(
    ...(await runBehavioralRlsChecks({
      supabaseUrl,
      supabaseAnonKey,
      consumerEmail,
      consumerPassword,
    })),
  )

  return checks
}

export function summarizeRlsChecks(checks: RlsCheck[]): { passed: number; failed: number; ok: boolean } {
  const failed = checks.filter((c) => !c.pass).length
  const passed = checks.filter((c) => c.pass).length
  return { passed, failed, ok: failed === 0 }
}
