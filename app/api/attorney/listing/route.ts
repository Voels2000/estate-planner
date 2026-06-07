import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'

export async function GET() {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const listingId = await getAttorneyListingIdForUser(supabase, user.id)
  if (!listingId) return NextResponse.json({ listing: null })

  const { data, error } = await supabase
    .from('attorney_listings')
    .select(
      'id, firm_name, contact_name, email, phone, website, city, state, bar_number, bio, fee_structure, specializations, states_licensed, serves_remote, referral_code',
    )
    .eq('id', listingId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ listing: data })
}

export async function PATCH(req: NextRequest) {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const supabase = await createClient()
  const listingId = await getAttorneyListingIdForUser(supabase, user.id)
  if (!listingId) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  const allowed = [
    'firm_name',
    'contact_name',
    'phone',
    'website',
    'city',
    'state',
    'bio',
    'fee_structure',
    'specializations',
    'states_licensed',
    'serves_remote',
  ] as const

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body?.[key] !== undefined) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('attorney_listings')
    .update(update)
    .eq('id', listingId)
    .select('id, firm_name, contact_name, email, phone, website, city, state, bio')
    .single()

  if (error) {
    console.error('[attorney/listing PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ listing: data })
}
