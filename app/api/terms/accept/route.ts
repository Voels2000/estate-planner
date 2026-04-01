import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TERMS_VERSION = '2026-03-31'

export async function POST() {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Write acceptance to profiles
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('terms accept error:', updateError)
    return NextResponse.json({ error: 'Failed to record acceptance' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
