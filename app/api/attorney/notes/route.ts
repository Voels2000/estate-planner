import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import { verifyAttorneyHouseholdAccess } from '@/lib/attorney/verifyAttorneyHouseholdAccess'

const VALID_NOTE_TYPES = new Set(['internal', 'meeting', 'follow_up'])

export async function GET(req: NextRequest) {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const householdId = req.nextUrl.searchParams.get('household_id')
  if (!householdId) return NextResponse.json({ error: 'household_id required' }, { status: 400 })

  const supabase = await createClient()
  const access = await verifyAttorneyHouseholdAccess(supabase, user.id, householdId)
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })

  const { data: notes, error } = await supabase
    .from('attorney_notes')
    .select('id, content, note_type, created_at, updated_at')
    .eq('attorney_listing_id', access.listingId)
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[attorney/notes GET]', error)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }

  return NextResponse.json({ notes: notes ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { household_id, content, note_type = 'internal' } = body ?? {}
  if (!household_id || !content?.trim()) {
    return NextResponse.json({ error: 'household_id and content required' }, { status: 400 })
  }

  const resolvedType = VALID_NOTE_TYPES.has(note_type) ? note_type : 'internal'
  const supabase = await createClient()
  const access = await verifyAttorneyHouseholdAccess(supabase, user.id, household_id)
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })

  const { data: note, error } = await supabase
    .from('attorney_notes')
    .insert({
      attorney_listing_id: access.listingId,
      household_id,
      content: content.trim(),
      note_type: resolvedType,
    })
    .select('id, content, note_type, created_at, updated_at')
    .single()

  if (error) {
    console.error('[attorney/notes POST]', error)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }

  return NextResponse.json({ note }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await createClient()
  const listingId = await getAttorneyListingIdForUser(supabase, user.id)
  if (!listingId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('attorney_notes')
    .delete()
    .eq('id', id)
    .eq('attorney_listing_id', listingId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
