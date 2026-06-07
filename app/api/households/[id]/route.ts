// app/api/households/[id]/route.ts
// PATCH — advisor-editable household fields

import { createClient } from '@/lib/supabase/server'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdParam } from '@/lib/api/schemas/householdAccess'
import { triggerHouseholdRecompute } from '@/lib/consumer/afterHouseholdWrite'
import { NextResponse } from 'next/server'

const ALLOWED_FIELDS = new Set(['admin_expense_pct'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const parsed = parseHouseholdIdParam(id)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Record<string, unknown>
    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) updates[key] = value
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No allowed fields provided' }, { status: 400 })
    }

    const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
    if (!access.ok) return access.response

    const { data, error } = await supabase
      .from('households')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', parsed.householdId)
      .select('id, admin_expense_pct, updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    triggerHouseholdRecompute(parsed.householdId)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[/api/households/[id]] PATCH error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
