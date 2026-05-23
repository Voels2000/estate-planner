import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite, resolveOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'

type SuccessionBody = {
  succession_plan_in_place: boolean
  succession_key_person_identified: boolean
  succession_buy_sell_in_place: boolean
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as SuccessionBody
  const householdId = await resolveOwnedHouseholdId(supabase, user.id)
  if (!householdId) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('households')
    .update({
      succession_plan_in_place: body.succession_plan_in_place,
      succession_key_person_identified: body.succession_key_person_identified,
      succession_buy_sell_in_place: body.succession_buy_sell_in_place,
      updated_at: new Date().toISOString(),
    })
    .eq('id', householdId)
    .eq('owner_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, householdId)
  return NextResponse.json({ ok: true })
}
