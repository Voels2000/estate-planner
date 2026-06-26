#!/usr/bin/env npx tsx
/**
 * Read-only audit: dashboard unlock gate for protected prod accounts.
 * Step 6 from dashboard-gate-change spec — verify assets/income/wizard/unlock state.
 *
 * Usage (production — read only):
 *   npx tsx scripts/audit-dashboard-gate.ts
 *
 * Requires .env.projects.local with PROD_* Supabase vars.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { canUnlockDashboard } from '../lib/dashboard/canUnlockDashboard'
import { isMinimumViableProfile } from '../lib/estate/profileGate'
import { fetchSetupProgressCounts } from '../lib/consumer/setupProgressCounts'
import { shouldShowOnramp } from '../lib/dashboard/onrampGate'

const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'

const ACCOUNTS = [
  { label: 'canary-consumer', email: 'canary-consumer@mywealthmaps.com' },
  { label: 'avoels', email: 'avoels@comcast.net' },
  { label: 'david', email: 'david@gmail.com' },
] as const

function getProjectsVar(name: string, contents: string): string {
  const match = contents.match(new RegExp(`^${name}=(.*)$`, 'm'))
  return match?.[1]?.trim().replace(/\r$/, '') ?? ''
}

function loadProdSupabaseEnv(): void {
  const projectsFile = join(process.cwd(), '.env.projects.local')
  if (!existsSync(projectsFile)) {
    console.error('Missing .env.projects.local')
    process.exit(1)
  }
  const contents = readFileSync(projectsFile, 'utf8')
  for (const [target, source] of [
    ['NEXT_PUBLIC_SUPABASE_URL', 'PROD_NEXT_PUBLIC_SUPABASE_URL'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'PROD_SUPABASE_SERVICE_ROLE_KEY'],
  ] as const) {
    const val = getProjectsVar(source, contents)
    if (!val) {
      console.error(`Missing ${source}`)
      process.exit(1)
    }
    process.env[target] = val
  }
}

function extractRef(url: string): string | null {
  try {
    return new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] ?? null
  } catch {
    return null
  }
}

async function main() {
  loadProdSupabaseEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const ref = extractRef(url)
  if (ref !== PRODUCTION_SUPABASE_PROJECT_REF) {
    console.error(`Ref must be ${PRODUCTION_SUPABASE_PROJECT_REF}, got ${ref ?? 'unknown'}`)
    process.exit(1)
  }

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(`\n=== Dashboard gate audit (prod ${ref}) ===\n`)

  const rows: Array<Record<string, unknown>> = []

  for (const { label, email } of ACCOUNTS) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, onboarding_wizard_completed_at')
      .eq('email', email)
      .maybeSingle()

    if (!profile?.id) {
      rows.push({ label, email, error: 'profile not found' })
      continue
    }

    const { data: household } = await admin
      .from('households')
      .select('id, person1_name, state_primary, filing_status, person1_birth_year')
      .eq('owner_id', profile.id)
      .maybeSingle()

    const progress = await fetchSetupProgressCounts(admin, profile.id)
    const profileComplete = isMinimumViableProfile(household ?? {}).complete
    const gateInput = {
      profileComplete,
      hasAssets: progress.assets > 0,
      hasIncome: progress.income > 0,
    }
    const unlocked = canUnlockDashboard(gateInput)
    const wouldShowOnramp = shouldShowOnramp(gateInput)

    rows.push({
      label,
      email,
      household_id: household?.id ?? null,
      wizard: profile.onboarding_wizard_completed_at != null,
      profile: {
        assets: progress.assets > 0,
        income: progress.income > 0,
      },
      counts: {
        assets: progress.assets,
        income: progress.income,
        expenses: progress.expenses,
      },
      profileComplete,
      unlocked,
      wouldShowOnramp,
    })
  }

  console.table(rows)
  console.log('\nExpected after gate deploy + canary re-seed:')
  console.log('  canary-consumer: income present, unlocked')
  console.log('  avoels: unlocked')
  console.log('  david: unlocked (no wizard OK)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
