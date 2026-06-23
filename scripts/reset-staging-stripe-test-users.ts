/**
 * Clear dangling Stripe columns on staging E2E / @mywealthmaps.test profiles
 * after re-keying Stripe (new sandbox, new price IDs, new sk_test).
 *
 * Usage: dotenv -e .env.local -- npx tsx scripts/reset-staging-stripe-test-users.ts
 */
import { createClient } from '@supabase/supabase-js'
import { DRIP_SMOKE_EMAIL, E2E_IDENTITIES } from './e2e-test-identities'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const STAGING_PROJECT_REF = 'cmzyxpxfyvdvbsykjvsg'

const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (ref !== STAGING_PROJECT_REF) {
  console.error(
    `Refusing: expected staging Supabase (${STAGING_PROJECT_REF}), got ${ref ?? 'unknown'}`,
  )
  process.exit(1)
}

const canonicalEmails = new Set<string>([
  DRIP_SMOKE_EMAIL,
  ...Object.values(E2E_IDENTITIES)
    .map((id) => ('email' in id ? id.email : null))
    .filter((e): e is string => Boolean(e)),
])

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

async function main() {
  const { data: testDomainRows, error: listError } = await admin
    .from('profiles')
    .select('email')
    .ilike('email', '%@mywealthmaps.test')

  if (listError) {
    console.error('Failed to list @mywealthmaps.test profiles:', listError.message)
    process.exit(1)
  }

  for (const row of testDomainRows ?? []) {
    if (row.email) canonicalEmails.add(row.email)
  }

  const emails = [...canonicalEmails].sort()
  console.log(`Resetting Stripe billing columns for ${emails.length} staging test profile(s)...`)

  const { data, error } = await admin
    .from('profiles')
    .update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: 'none',
      subscription_plan: null,
      subscription_period_end: null,
    })
    .in('email', emails)
    .select('email, subscription_status, stripe_customer_id')

  if (error) {
    console.error('Update failed:', error.message)
    process.exit(1)
  }

  for (const row of data ?? []) {
    console.log(`  ✓ ${row.email}`)
  }
  console.log(`Done — ${data?.length ?? 0} profile(s) cleared.`)
}

main()
