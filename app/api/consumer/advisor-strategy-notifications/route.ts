import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdvisorStrategyNotifications } from '@/lib/consumer/createAdvisorStrategyNotifications'
import { resolveOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const householdId = await resolveOwnedHouseholdId(supabase, user.id)
  if (!householdId) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  const created = await createAdvisorStrategyNotifications(supabase, user.id, householdId)
  return NextResponse.json({ created })
}
