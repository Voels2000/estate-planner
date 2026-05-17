import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite } from '@/lib/consumer/afterHouseholdWrite'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { household_id, asset_type, platform, description, estimated_value,
    wallet_address, account_username, storage_location, access_instructions,
    executor_grantee_email, executor_notes } = body

  if (!household_id || !asset_type || !platform) {
    return NextResponse.json({ error: 'household_id, asset_type, and platform required' }, { status: 400 })
  }

  // Verify household ownership
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('id', household_id)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!household) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('digital_assets')
    .insert({
      household_id,
      owner_id: user.id,
      name: platform,
      asset_type,
      platform,
      description: description ?? null,
      estimated_value: estimated_value ?? null,
      wallet_address: wallet_address ?? null,
      account_username: account_username ?? null,
      storage_location: storage_location ?? null,
      access_instructions: access_instructions ?? null,
      executor_grantee_email: executor_grantee_email ?? null,
      executor_notes: executor_notes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[digital-assets:post]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, household_id)
  revalidatePath('/digital-assets')
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, household_id } = body

  if (!id || !household_id) {
    return NextResponse.json({ error: 'id and household_id required' }, { status: 400 })
  }

  // Verify household ownership
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('id', household_id)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!household) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('digital_assets')
    .delete()
    .eq('id', id)
    .eq('household_id', household_id)

  if (error) {
    console.error('[digital-assets:delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, household_id)
  revalidatePath('/digital-assets')
  return NextResponse.json({ success: true })
}
