// app/api/households/[id]/route.ts
// PATCH — advisor-editable household fields
// Currently supports: admin_expense_pct
// Auth-gated — caller must be the household owner OR an active advisor for the household.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Fields advisors are permitted to update via this route.
// Add new fields here as needed — do not allow arbitrary column updates.
const ALLOWED_FIELDS = new Set([
  'admin_expense_pct',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: householdId } = await params

    if (!householdId) {
      return NextResponse.json({ error: 'householdId required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Record<string, unknown>

    // Filter to only allowed fields
    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No allowed fields provided' }, { status: 400 })
    }

    // Verify caller is owner OR active advisor for this household
    const { data: household } = await supabase
      .from('households')
      .select('id, owner_id')
      .eq('id', householdId)
      .single()

    if (!household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 })
    }

    const isOwner = household.owner_id === user.id

    let isAdvisor = false
    if (!isOwner) {
      const { data: link } = await supabase
        .from('advisor_clients')
        .select('id')
        .eq('advisor_id', user.id)
        .eq('client_id', household.owner_id)
        .eq('status', 'active')
        .single()
      isAdvisor = !!link
    }

    if (!isOwner && !isAdvisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Apply update — also bump updated_at for staleness detection
    const { data, error } = await supabase
      .from('households')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', householdId)
      .select('id, admin_expense_pct, updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[/api/households/[id]] PATCH error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
