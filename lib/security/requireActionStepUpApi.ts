import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { actionStepUpSatisfied, isActionGatedStepUpEnabled } from '@/lib/security/actionGatedStepUp'

export async function requireActionStepUpApi(
  supabase: SupabaseClient,
): Promise<NextResponse | null> {
  if (!isActionGatedStepUpEnabled()) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (await actionStepUpSatisfied(supabase, user)) return null
  return NextResponse.json(
    {
      error: 'Complete security setup (password + two-factor) before accessing client data.',
      step_up_required: true,
      step_up_path: '/security-step-up',
    },
    { status: 403 },
  )
}
