import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { loadAssetAllocationData } from '@/lib/allocation/loadAssetAllocationData'

export async function GET() {
  const access = await getUserAccess()
  if (access.tier < 2) {
    return NextResponse.json({ error: 'Tier 2 required' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await loadAssetAllocationData(supabase, user.id)
  if (!data) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
