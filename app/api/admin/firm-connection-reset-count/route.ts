import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { adminClearFirmResetCount } from '@/lib/billing/firmConnectionStickyFloor'

export const dynamic = 'force-dynamic'

/** Admin-only: clear self-serve reset counter after support-mediated adjustment. */
export async function POST(request: Request) {
  const ctx = await getAccessContext()
  if (!ctx.user || !ctx.isSuperuser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const firmId = typeof body.firm_id === 'string' ? body.firm_id.trim() : ''
  if (!firmId) {
    return NextResponse.json({ error: 'firm_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  try {
    await adminClearFirmResetCount(admin, firmId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin reset failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true, firm_id: firmId, reset_count: 0 })
}
