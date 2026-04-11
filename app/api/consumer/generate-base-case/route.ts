import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateBaseCase } from '@/lib/actions/generate-base-case'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { householdId } = await request.json()
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

  // Verify the logged-in user owns this household
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('id', householdId)
    .eq('owner_id', user.id)
    .single()

  if (!household) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await generateBaseCase(householdId)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ success: true, scenarioId: result.scenarioId })
}
