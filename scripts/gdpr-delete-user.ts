#!/usr/bin/env tsx
/**
 * WCPA right-to-delete CLI — Sprint C-6
 *
 * Usage:
 *   npx tsx scripts/gdpr-delete-user.ts --email user@example.com --dry-run
 *   npx tsx scripts/gdpr-delete-user.ts --email user@example.com
 *
 * Uses lib/compliance/deleteUser.ts (same path as admin UI and cron).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { deleteUserData } from '../lib/compliance/deleteUser'

const args = process.argv.slice(2)
const emailArg =
  args.find((a) => a.startsWith('--email='))?.split('=')[1] ??
  args[args.indexOf('--email') + 1]
const dryRun = args.includes('--dry-run')

if (!emailArg) {
  console.error(
    'Usage: npx tsx scripts/gdpr-delete-user.ts --email user@example.com [--dry-run]',
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

const { data: listData, error: listError } = await admin.auth.admin.listUsers({
  perPage: 1000,
})
if (listError) {
  console.error('Failed to list users:', listError.message)
  process.exit(1)
}

const user = listData.users.find(
  (u) => u.email?.toLowerCase() === emailArg.toLowerCase(),
)
if (!user) {
  console.error('User not found:', emailArg)
  process.exit(1)
}

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Deleting user: ${emailArg} (${user.id})\n`)

const result = await deleteUserData({
  userId: user.id,
  email: emailArg,
  reason: 'user_request',
  initiatedBy: 'cli',
  dryRun,
  supabaseUrl: url,
  supabaseServiceKey: key,
})

if (result.success) {
  console.log(`\n✅ ${dryRun ? '[DRY RUN] ' : ''}Complete`)
  console.log('\nRows deleted:')
  Object.entries(result.rowsDeleted)
    .filter(([, count]) => count > 0)
    .forEach(([table, count]) => console.log(`  ${table}: ${count}`))
  console.log(`\nAuth user deleted: ${result.authUserDeleted}`)
  if (dryRun) console.log('\nRun without --dry-run to execute.')
} else {
  console.error('\n❌ Deletion failed:', result.error)
  process.exit(1)
}
