import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

export type AdvisorNoteType = 'prep' | 'meeting_record' | 'follow_up'

const VALID_NOTE_TYPES = new Set<AdvisorNoteType>(['prep', 'meeting_record', 'follow_up'])

// ── GET — list notes ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const noteType = req.nextUrl.searchParams.get('note_type')
  const supabase = await createClient()

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', ctx.user.id)
    .eq('client_id', clientId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .single()

  if (!link) return NextResponse.json({ error: 'Client not linked' }, { status: 403 })

  let query = supabase
    .from('advisor_notes')
    .select('*')
    .eq('client_id', clientId)
    .eq('advisor_id', ctx.user.id)
    .order('created_at', { ascending: false })

  if (noteType && VALID_NOTE_TYPES.has(noteType as AdvisorNoteType)) {
    query = query.eq('note_type', noteType)
  }

  const { data: notes, error } = await query
  if (error) {
    console.error('[advisor/notes GET]', error)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }

  return NextResponse.json({ notes: notes ?? [] })
}

// ── POST — create note ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ctx = await getAccessContext()
  if (!ctx.user)      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdvisor) return NextResponse.json({ error: 'Forbidden' },    { status: 403 })

  const body = await req.json().catch(() => null)
  const { client_id, content, note_type = 'meeting_record' } = body ?? {}

  if (!client_id || !content?.trim()) {
    return NextResponse.json({ error: 'client_id and content required' }, { status: 400 })
  }

  const resolvedNoteType = VALID_NOTE_TYPES.has(note_type) ? note_type : 'meeting_record'

  const supabase = await createClient()

  // Verify active link before writing
  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', ctx.user.id)
    .eq('client_id', client_id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .single()

  if (!link) return NextResponse.json({ error: 'Client not linked' }, { status: 403 })

  const { data: note, error } = await supabase
    .from('advisor_notes')
    .insert({
      advisor_id: ctx.user.id,
      client_id,
      content: content.trim(),
      note_type: resolvedNoteType,
    })
    .select()
    .single()

  if (error) {
    console.error('[advisor/notes POST]', error)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }

  return NextResponse.json({ note }, { status: 201 })
}

// ── PATCH — update note ───────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const ctx = await getAccessContext()
  if (!ctx.user)      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdvisor) return NextResponse.json({ error: 'Forbidden' },    { status: 403 })

  const body = await req.json().catch(() => null)
  const { id, content } = body ?? {}

  if (!id || !content?.trim()) {
    return NextResponse.json({ error: 'id and content required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: note, error } = await supabase
    .from('advisor_notes')
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('advisor_id', ctx.user.id)
    .select()
    .single()

  if (error || !note) {
    console.error('[advisor/notes PATCH]', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }

  return NextResponse.json({ note })
}

// ── DELETE — delete note ──────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const ctx = await getAccessContext()
  if (!ctx.user)      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdvisor) return NextResponse.json({ error: 'Forbidden' },    { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await createClient()

  const { error } = await supabase
    .from('advisor_notes')
    .delete()
    .eq('id', id)
    .eq('advisor_id', ctx.user.id)

  if (error) {
    console.error('[advisor/notes DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
