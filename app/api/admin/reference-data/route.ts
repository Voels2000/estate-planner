import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TABLES = new Set([
  'asset_types',
  'ref_titling_types',
  'ref_liquidity_types',
  'business_entity_types',
  'ref_valuation_methods',
  'ref_succession_plans',
])

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_superuser')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_superuser) {
    return { supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase, error: null }
}

export async function POST(request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const tableName = String(body.tableName ?? '')
  if (!ALLOWED_TABLES.has(tableName)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  const { data, error: insertError } = await supabase
    .from(tableName)
    .insert({
      value: body.value,
      label: body.label,
      description: body.description ?? null,
      sort_order: Number(body.sort_order ?? 0),
      is_active: true,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const tableName = String(body.tableName ?? '')
  if (!ALLOWED_TABLES.has(tableName)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  const { data, error: updateError } = await supabase
    .from(tableName)
    .update({ is_active: !!body.is_active })
    .eq('id', body.id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  return NextResponse.json(data)
}
