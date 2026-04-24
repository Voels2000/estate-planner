import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerEstateHealthRecompute } from '@/lib/estate/triggerEstateHealthRecompute'

// ─── PATCH — update an asset by id ───────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  // Fetch the asset first so we know which household it belongs to
  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, household_id')
    .eq('id', id)
    .single()

  if (fetchError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  // Verify ownership: the asset's household must be owned by the current user
  const { data: household, error: hhError } = await supabase
    .from('households')
    .select('id')
    .eq('id', asset.household_id)
    .eq('owner_id', user.id)
    .single()

  if (hhError || !household) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Apply the update
  const { data, error } = await supabase
    .from('assets')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Fire recompute (non-blocking — failure logged, not thrown)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  triggerEstateHealthRecompute(asset.household_id, appUrl).catch((e) =>
    console.error('[assets PATCH] recompute error:', e),
  )

  return NextResponse.json({ data })
}

// ─── DELETE — remove an asset by id ──────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch asset to get household_id before deleting
  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, household_id')
    .eq('id', id)
    .single()

  if (fetchError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  // Verify ownership
  const { data: household, error: hhError } = await supabase
    .from('households')
    .select('id')
    .eq('id', asset.household_id)
    .eq('owner_id', user.id)
    .single()

  if (hhError || !household) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('assets').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Fire recompute (non-blocking)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  triggerEstateHealthRecompute(asset.household_id, appUrl).catch((e) =>
    console.error('[assets DELETE] recompute error:', e),
  )

  return NextResponse.json({ success: true })
}
