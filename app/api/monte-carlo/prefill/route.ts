import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { loadMonteCarloPrefill } from '@/lib/monte-carlo/loadMonteCarloPrefill'

export async function GET() {
  const access = await getUserAccess()
  if (access.tier < 3) {
    return NextResponse.json({ error: 'Tier 3 required' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await loadMonteCarloPrefill(user.id)
  return NextResponse.json(data)
}
