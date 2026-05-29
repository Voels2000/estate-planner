import { createClient } from '@/lib/supabase/server'
import { recordTermsAcceptance } from '@/lib/terms/recordTermsAcceptance'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await recordTermsAcceptance(user.id)
  if (!result.ok) {
    return NextResponse.json({ error: 'Failed to record acceptance' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
