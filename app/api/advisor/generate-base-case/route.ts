import { NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { generateBaseCase } from '@/lib/actions/generate-base-case'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, isAdvisor, isSuperuser } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdvisor && !isSuperuser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { householdId } = await request.json()
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

  // Verify advisor has access to this household
  const admin = createAdminClient()
  const { data: household } = await admin
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single()

  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  if (!isSuperuser) {
    const { data: link } = await admin
      .from('advisor_clients')
      .select('id')
      .eq('advisor_id', user.id)
      .eq('client_id', household.owner_id)
      .eq('status', 'active')
      .single()

    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await generateBaseCase(householdId)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, scenarioId: result.scenarioId })
}
