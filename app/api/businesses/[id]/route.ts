import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function resolveBusinessAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  userId: string,
): Promise<{ ownerId: string | null; allowed: boolean }> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, owner_id')
    .eq('id', businessId)
    .single()

  if (!biz) return { ownerId: null, allowed: false }

  const isOwner = biz.owner_id === userId
  if (isOwner) return { ownerId: biz.owner_id, allowed: true }

  // Check advisor link
  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', userId)
    .eq('client_id', biz.owner_id)
    .eq('status', 'active')
    .single()

  return { ownerId: biz.owner_id, allowed: !!link }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ownerId, allowed } = await resolveBusinessAuth(supabase, id, user.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!ownerId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('businesses')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Touch households.updated_at for staleness detection
  await supabase
    .from('households')
    .update({ updated_at: new Date().toISOString() })
    .eq('owner_id', ownerId)

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ownerId, allowed } = await resolveBusinessAuth(supabase, id, user.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!ownerId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('businesses')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase
    .from('households')
    .update({ updated_at: new Date().toISOString() })
    .eq('owner_id', ownerId)

  return NextResponse.json({ success: true })
}
