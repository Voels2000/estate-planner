import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Marks onboarding wizard (and invite-advisor gate) complete for the signed-in consumer. */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_wizard_completed_at: now,
      onboarding_invite_advisor_completed_at: now,
      updated_at: now,
    })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
