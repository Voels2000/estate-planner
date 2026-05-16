import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  afterHouseholdWrite,
  requireOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'
import {
  assertEntityTitlingAccess,
  parseEntityTitlingBody,
  saveEntityTitling,
} from '@/lib/titling/entityTitling'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = parseEntityTitlingBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  if (!(await assertEntityTitlingAccess(supabase, user.id, parsed.ref))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await saveEntityTitling(supabase, user.id, parsed)
  if ('error' in result) {
    const status = result.error === 'Titling row not found' ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  await afterHouseholdWrite(supabase, owned.householdId)

  return NextResponse.json(result)
}
