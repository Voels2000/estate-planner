import { NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { generateBaseCase } from '@/lib/actions/generate-base-case'
import { createClient } from '@/lib/supabase/server'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdBody } from '@/lib/api/schemas/householdAccess'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, isAdvisor, isSuperuser } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdvisor && !isSuperuser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = parseHouseholdIdBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (!isSuperuser) {
    const supabase = await createClient()
    const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
    if (!access.ok) return access.response
  }

  const result = await generateBaseCase(parsed.householdId)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, scenarioId: result.scenarioId })
}
