#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'

const emails = process.argv.slice(2)
if (emails.length === 0) {
  console.error('Usage: npx tsx scripts/check-auth-emails.ts email@example.com ...')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error

  for (const email of emails) {
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
    if (!u) {
      console.log(`${email}: NOT FOUND`)
      continue
    }
    const deleted = u.deleted_at ? ` soft-deleted at ${u.deleted_at}` : ''
    console.log(`${email}: EXISTS id=${u.id}${deleted}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
