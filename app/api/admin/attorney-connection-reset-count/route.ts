import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { adminClearAttorneyResetCount } from '@/lib/billing/attorneyConnectionStickyFloor'

export const dynamic = 'force-dynamic'

/** Admin-only: clear self-serve reset counter after support-mediated adjustment. */
export async function POST(request: Request) {
  const ctx = await getAccessContext()
  if (!ctx.user || !ctx.isSuperuser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const listingId = typeof body.attorney_listing_id === 'string' ? body.attorney_listing_id.trim() : ''
  if (!listingId) {
    return NextResponse.json({ error: 'attorney_listing_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  try {
    await adminClearAttorneyResetCount(admin, listingId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin reset failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true, attorney_listing_id: listingId, reset_count: 0 })
}
