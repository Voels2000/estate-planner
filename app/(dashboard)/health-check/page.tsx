// ─────────────────────────────────────────
// Menu: My Estate Plan > Estate Health Check
// Route: /health-check
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HealthCheckClient } from './_health-check-client'

function boolToAnswer(value: boolean | null | undefined): 'yes' | 'no' | null {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return null
}

export default async function HealthCheckPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!household) redirect('/profile')

  const { data: existing } = await supabase
    .from('estate_health_check')
    .select('has_will, has_trust, has_poa, has_hcd, beneficiaries_current')
    .eq('household_id', household.id)
    .maybeSingle()

  const initialAnswers = existing
    ? {
        has_will: boolToAnswer(existing.has_will),
        has_trust: boolToAnswer(existing.has_trust),
        has_poa: boolToAnswer(existing.has_poa),
        has_hcd: boolToAnswer(existing.has_hcd),
        beneficiaries_current: boolToAnswer(existing.beneficiaries_current),
      }
    : null

  return <HealthCheckClient householdId={household.id} initialAnswers={initialAnswers} />
}
