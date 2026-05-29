import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite, resolveOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'
import { isOnboardingPersona } from '@/lib/onboarding/personaConfig'
import {
  buildHouseholdRow,
  validateProfileSavePayload,
  type ProfileSavePayload,
} from '@/lib/profile/buildHouseholdPayload'
import { loadProfileSavePayloadForUser } from '@/lib/profile/loadProfileSavePayloadForUser'
import { mergeProfilePatch } from '@/lib/profile/mergeProfilePatch'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as Partial<ProfileSavePayload> & {
    onboarding_persona?: string
  }

  if (body.onboarding_persona !== undefined) {
    if (!isOnboardingPersona(body.onboarding_persona)) {
      return NextResponse.json({ error: 'Invalid onboarding persona' }, { status: 400 })
    }

    const { data: existingPersona } = await supabase
      .from('profiles')
      .select('persona_set_at')
      .eq('id', user.id)
      .single()

    const personaUpdates: Record<string, string> = {
      onboarding_persona: body.onboarding_persona,
      updated_at: new Date().toISOString(),
    }
    if (!existingPersona?.persona_set_at) {
      personaUpdates.persona_set_at = new Date().toISOString()
    }

    const { error: personaError } = await supabase
      .from('profiles')
      .update(personaUpdates)
      .eq('id', user.id)

    if (personaError) {
      return NextResponse.json({ error: personaError.message }, { status: 500 })
    }

    const bodyKeys = Object.keys(body)
    if (bodyKeys.length === 1 && bodyKeys[0] === 'onboarding_persona') {
      return NextResponse.json({ ok: true })
    }
  }
  const existing = await loadProfileSavePayloadForUser(supabase, user.id)
  const payload: ProfileSavePayload = existing
    ? mergeProfilePatch(existing, body)
    : (body as ProfileSavePayload)

  const validationErrors = validateProfileSavePayload(payload)
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join(' ') }, { status: 400 })
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: payload.fullName,
      email: payload.email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  let householdId = payload.householdId ?? null
  let created = false
  let existingDefaults = null

  if (householdId) {
    const ownedId = await resolveOwnedHouseholdId(supabase, user.id, householdId)
    if (!ownedId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    householdId = ownedId

    const { data: existing } = await supabase
      .from('households')
      .select(
        'inflation_rate, risk_tolerance, growth_rate_accumulation, growth_rate_retirement',
      )
      .eq('id', ownedId)
      .eq('owner_id', user.id)
      .single()

    existingDefaults = existing
  }

  const householdRow = buildHouseholdRow(user.id, payload, existingDefaults)

  if (householdId && !created) {
    const { error: householdError } = await supabase
      .from('households')
      .update(householdRow)
      .eq('id', householdId)
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
