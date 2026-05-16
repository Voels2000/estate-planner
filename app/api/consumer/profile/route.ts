import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite, resolveOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'
import {
  buildHouseholdRow,
  validateProfileSavePayload,
  type ProfileSavePayload,
} from '@/lib/profile/buildHouseholdPayload'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as ProfileSavePayload
  const validationErrors = validateProfileSavePayload(body)
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join(' ') }, { status: 400 })
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: body.fullName,
      email: body.email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const householdRow = buildHouseholdRow(user.id, body)
  let householdId = body.householdId ?? null
  let created = false

  if (householdId) {
    const ownedId = await resolveOwnedHouseholdId(supabase, user.id, householdId)
    if (!ownedId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: householdError } = await supabase
      .from('households')
      .update(householdRow)
      .eq('id', ownedId)
      .eq('owner_id', user.id)

    if (householdError) {
      return NextResponse.json({ error: householdError.message }, { status: 500 })
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('households')
      .insert(householdRow)
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    householdId = inserted.id
    created = true

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'advisor') {
      await supabase.from('profiles').update({ consumer_tier: 3 }).eq('id', user.id)
    }
  }

  if (householdId) {
    await afterHouseholdWrite(supabase, householdId)
  } else {
    const resolvedId = await resolveOwnedHouseholdId(supabase, user.id)
    if (resolvedId) await afterHouseholdWrite(supabase, resolvedId)
  }

  return NextResponse.json({ householdId, created })
}
