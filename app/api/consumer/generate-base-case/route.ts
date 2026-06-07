import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateBaseCase } from '@/lib/actions/generate-base-case'
import { afterHouseholdWrite } from '@/lib/consumer/afterHouseholdWrite'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdBody } from '@/lib/api/schemas/householdAccess'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = parseHouseholdIdBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId, {
    ownerOnly: true,
  })
  if (!access.ok) return access.response

  const result = await generateBaseCase(parsed.householdId)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, parsed.householdId)

  return NextResponse.json({ success: true, scenarioId: result.scenarioId })
}
