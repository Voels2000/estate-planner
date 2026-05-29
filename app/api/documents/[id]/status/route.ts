import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { doc_status, executed_date, status_notes } = body as {
    doc_status?: string
    executed_date?: string | null
    status_notes?: string | null
  }

  const { data: doc } = await supabase
    .from('legal_documents')
    .select('id, household_id, attorney_id')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data: listing } = await supabase
    .from('attorney_listings')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  const { data: connection } = listing
    ? await supabase
        .from('attorney_clients')
        .select('id')
        .eq('attorney_id', listing.id)
        .eq('client_id', doc.household_id)
        .in('status', ['active', 'accepted'])
        .maybeSingle()
    : { data: null }

  if (!connection) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (doc_status) updates.doc_status = doc_status
  if (executed_date !== undefined) updates.executed_date = executed_date
  if (status_notes !== undefined) updates.status_notes = status_notes

  const { data, error } = await supabase
    .from('legal_documents')
    .update(updates)
    .eq('id', id)
    .select('id, doc_status, executed_date, status_notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
