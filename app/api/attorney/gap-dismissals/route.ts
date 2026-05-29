import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { household_id, gap_key, note } = body as {
    household_id?: string
    gap_key?: string
    note?: string
  }

  if (!household_id || !gap_key) {
    return NextResponse.json({ error: 'household_id and gap_key required' }, { status: 400 })
  }

  const { data: listing } = await supabase
    .from('attorney_listings')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!listing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: connection } = await supabase
    .from('attorney_clients')
    .select('id')
    .eq('attorney_id', listing.id)
    .eq('client_id', household_id)
    .in('status', ['active', 'accepted'])
    .maybeSingle()

  if (!connection) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('document_gap_dismissals').upsert(
    {
      household_id,
      attorney_id: user.id,
      gap_key,
      note: note ?? null,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: 'household_id,attorney_id,gap_key' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
