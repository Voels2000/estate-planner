import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELETE_EMAILS = [
  'consumer3@rolobe.resend.app',
  'consumer5@rolobe.resend.app',
  'consumer11@rolobe.resend.app',
  'consumer15@rolobe.resend.app',
  'consumer17@rolobe.resend.app',
  'consumer18@rolobe.resend.app',
  'consumer19@rolobe.resend.app',
  'consumer20@rolobe.resend.app',
]

import { E2E_IDENTITIES, LEGACY_E2E_EMAILS } from './e2e-test-identities'

/** Never delete canonical E2E v2 accounts or drip smoke inbox. */
const PROTECTED = [
  E2E_IDENTITIES.consumer.email,
  E2E_IDENTITIES.consumerTier1.email,
  E2E_IDENTITIES.advisor.email,
  E2E_IDENTITIES.advisorClient.email,
  E2E_IDENTITIES.attorneyPortal.email,
  E2E_IDENTITIES.advisorListing.email,
  E2E_IDENTITIES.attorneyListing.email,
  'consumer21@rolobe.resend.app',
  // Legacy — remove from this list after migrating .env.test and deleting:
  'david@rolobe.resend.app',
  'advisor@rolobe.resend.app',
  'advisor2@rolobe.resend.app',
  'consumer1@rolobe.resend.app',
  'test-attorney-portal@rolobe.resend.app',
]

/** Candidates for deletion when cleaning pre-go-live clutter. */
const LEGACY_DELETE_CANDIDATES = [
  ...LEGACY_E2E_EMAILS.filter(
    (e) =>
      !PROTECTED.includes(e) &&
      e !== 'consumer21@rolobe.resend.app',
  ),
]

async function deleteUserWithHouseholdData(userId: string, email: string): Promise<boolean> {
  const { data: households, error: householdFindErr } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', userId)

  if (householdFindErr) {
    console.log(`households lookup ${email}: ${householdFindErr.message}`)
    return false
  }

  const householdIds = (households ?? []).map((h) => h.id)
  console.log(
    `households lookup ${email}: found ${householdIds.length}${
      householdIds.length ? ` (${householdIds.join(', ')})` : ''
    }`
  )

  if (householdIds.length > 0) {
    const { error: recErr, count: recCount } = await supabase
      .from('estate_recommendations')
      .delete({ count: 'exact' })
      .in('household_id', householdIds)

    if (recErr) {
      console.log(`estate_recommendations ${email}: ${recErr.message}`)
      return false
    }
    console.log(`estate_recommendations ${email}: deleted ${recCount ?? 0}`)
  } else {
    console.log(`estate_recommendations ${email}: skipped (no households)`)
  }

  const { error: hhDelErr, count: hhDelCount } = await supabase
    .from('households')
    .delete({ count: 'exact' })
    .eq('owner_id', userId)

  if (hhDelErr) {
    console.log(`households delete ${email}: ${hhDelErr.message}`)
    return false
  }
  console.log(`households delete ${email}: deleted ${hhDelCount ?? 0}`)

  const { error: profileErr, count: profileCount } = await supabase
    .from('profiles')
    .delete({ count: 'exact' })
    .eq('id', userId)

  if (profileErr) {
    console.log(`profiles ${email}: ${profileErr.message}`)
    return false
  }
  console.log(`profiles ${email}: deleted ${profileCount ?? 0}`)

  const { error: delErr } = await supabase.auth.admin.deleteUser(userId)
  if (delErr) {
    console.log(`auth user ${email}: ${delErr.message}`)
    return false
  }
  console.log(`auth user ${email}: deleted`)
  return true
}

async function main() {
  const emails = process.argv.includes('--legacy')
    ? [...new Set([...DELETE_EMAILS, ...LEGACY_DELETE_CANDIDATES])]
    : DELETE_EMAILS

  if (process.argv.includes('--legacy')) {
    console.log('Including legacy E2E emails (--legacy). Protected list still enforced.\n')
  }

  for (const email of emails) {
    if (PROTECTED.includes(email)) {
      console.error(`SAFETY: refusing to delete protected account ${email}`)
      continue
    }

    // Delete from email_captures
    const { error: capErr } = await supabase
      .from('email_captures')
      .delete()
      .eq('email', email)
    if (capErr) {
      console.log(`email_captures ${email}: ${capErr.message}`)
    } else {
      console.log(`email_captures ${email}: deleted`)
    }

    // Find and delete auth user
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
    if (listErr) { console.error(`listUsers error: ${listErr.message}`); continue }

    const user = users.find(u => u.email === email)
    if (!user) {
      console.log(`auth user ${email}: not found`)
      continue
    }

    await deleteUserWithHouseholdData(user.id, email)
  }
  console.log('Done.')
}

main().catch(console.error)
