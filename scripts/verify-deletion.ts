#!/usr/bin/env tsx
/**
 * Verify a user's data has been fully deleted.
 * Run after deleteUserData to confirm WCPA compliance.
 *
 * Usage: npx tsx scripts/verify-deletion.ts --email user@example.com
 *        npx tsx scripts/verify-deletion.ts --user-id uuid
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const emailArg =
  args.find((a) => a.startsWith('--email='))?.split('=')[1] ??
  args[args.indexOf('--email') + 1]
const userIdArg =
  args.find((a) => a.startsWith('--user-id='))?.split('=')[1] ??
  args[args.indexOf('--user-id') + 1]

if (!emailArg && !userIdArg) {
  console.error(
    'Usage: npx tsx scripts/verify-deletion.ts --email user@example.com\n' +
      '       npx tsx scripts/verify-deletion.ts --user-id uuid',
  )
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type CheckResult = { name: string; pass: boolean; detail: string }

async function countRows(table: string, column: string, value: string): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value)
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function main() {
  let userId = userIdArg ?? null
  let email = emailArg ?? null

  if (email && !userId) {
    const { data: listData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listError) {
      console.error('Failed to list auth users:', listError.message)
      process.exit(1)
    }
    const authUser = listData.users.find((u) => u.email?.toLowerCase() === email!.toLowerCase())
    if (authUser) {
      userId = authUser.id
    }
  }

  if (userId && !email) {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (!error && data.user?.email) email = data.user.email
  }

  if (!userId) {
    console.error('Could not resolve user ID — provide --email or --user-id')
    process.exit(1)
  }

  const checks: CheckResult[] = []

  // Auth user should not exist (or be soft-deleted)
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId)
  if (authError || !authData.user) {
    checks.push({ name: 'auth.users', pass: true, detail: 'not found' })
  } else if (authData.user.deleted_at) {
    checks.push({
      name: 'auth.users',
      pass: true,
      detail: `soft-deleted at ${authData.user.deleted_at}`,
    })
  } else {
    checks.push({
      name: 'auth.users',
      pass: false,
      detail: `still exists (${authData.user.email ?? userId})`,
    })
  }

  const profileCount = await countRows('profiles', 'id', userId)
  checks.push({
    name: 'profiles',
    pass: profileCount === 0,
    detail: profileCount === 0 ? '0 rows' : `${profileCount} rows remain`,
  })

  const householdCount = await countRows('households', 'owner_id', userId)
  checks.push({
    name: 'households',
    pass: householdCount === 0,
    detail: householdCount === 0 ? '0 rows' : `${householdCount} rows remain`,
  })

  for (const table of ['assets', 'income', 'expenses', 'liabilities'] as const) {
    const n = await countRows(table, 'owner_id', userId)
    checks.push({
      name: table,
      pass: n === 0,
      detail: n === 0 ? '0 rows' : `${n} rows remain`,
    })
  }

  const { data: auditRows, error: auditError } = await admin
    .from('deletion_audit_log')
    .select('id, success, auth_deleted, completed_at, dry_run, error_message')
    .eq('user_id', userId)
    .eq('success', true)
    .eq('dry_run', false)
    .order('completed_at', { ascending: false })
    .limit(1)

  if (auditError) {
    checks.push({ name: 'deletion_audit_log', pass: false, detail: auditError.message })
  } else if (!auditRows?.length) {
    checks.push({
      name: 'deletion_audit_log',
      pass: false,
      detail: 'no successful non-dry-run entry found',
    })
  } else {
    const entry = auditRows[0]
    checks.push({
      name: 'deletion_audit_log',
      pass: true,
      detail: `success entry ${entry.id} (${entry.completed_at})`,
    })
  }

  console.log(`\nDeletion verification for ${email ?? userId}\n`)
  for (const check of checks) {
    console.log(`  ${check.pass ? '✓' : '✗'} ${check.name}: ${check.detail}`)
  }

  const allPass = checks.every((c) => c.pass)
  console.log(`\nCompliance summary: ${allPass ? 'PASS' : 'FAIL'}\n`)
  process.exit(allPass ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
