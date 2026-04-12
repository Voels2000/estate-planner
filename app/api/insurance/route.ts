import { createClient } from '@/lib/supabase/server'
import { insurancePolicyRowForSave } from '@/lib/insurance-policy-save-payload'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const row = insurancePolicyRowForSave(body as Record<string, unknown>)
  const { data, error } = await supabase
    .from('insurance_policies')
    .insert({ ...row, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
