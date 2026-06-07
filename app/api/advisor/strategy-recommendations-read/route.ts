import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdBody } from '@/lib/api/schemas/householdAccess'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = parseHouseholdIdBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
  if (!access.ok) return access.response

  const { data, error } = await supabase
    .from('strategy_line_items')
    .select('id, strategy_source, amount, sign, scenario_name, consumer_accepted, consumer_rejected, created_at')
    .eq('household_id', parsed.householdId)
    .eq('source_role', 'advisor')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}
