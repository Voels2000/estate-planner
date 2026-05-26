import { NextResponse } from 'next/server'
import { fetchSetupProgressCounts } from '@/lib/consumer/setupProgressCounts'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const progress = await fetchSetupProgressCounts(supabase, user.id)
  return NextResponse.json(progress)
}
