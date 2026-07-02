import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import {
  normalizeAttorneyCredentials,
  normalizeAttorneyFeeStructure,
  normalizeAttorneySpecializations,
  normalizeLicensedStates,
} from '@/lib/attorney/attorneyPracticeOptions'

const LISTING_SELECT =
  'id, firm_name, contact_name, email, phone, website, city, state, bar_number, bio, fee_structure, specializations, states_licensed, credentials, serves_remote, referral_code'

export async function GET() {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const listingId = await getAttorneyListingIdForUser(supabase, user.id)
  if (!listingId) return NextResponse.json({ listing: null })

  const { data, error } = await supabase
    .from('attorney_listings')
    .select(LISTING_SELECT)
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
    'bar_number',
    'bio',
    'fee_structure',
    'specializations',
    'states_licensed',
    'credentials',
    'serves_remote',
  ] as const

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body?.[key] === undefined) continue
    if (key === 'bar_number') {
      const trimmed = typeof body[key] === 'string' ? body[key].trim() : ''
      update[key] = trimmed || null
      continue
    }
    if (key === 'fee_structure') {
      const normalized = normalizeAttorneyFeeStructure(
        typeof body[key] === 'string' ? body[key] : null,
      )
      if (body[key] && !normalized) {
        return NextResponse.json({ error: 'Invalid fee structure' }, { status: 400 })
      }
      update[key] = normalized
      continue
    }
    if (key === 'specializations' && Array.isArray(body[key])) {
      update[key] = normalizeAttorneySpecializations(body[key] as string[])
      continue
    }
    if (key === 'states_licensed' && Array.isArray(body[key])) {
      update[key] = normalizeLicensedStates(body[key] as string[])
      continue
    }
    if (key === 'credentials' && Array.isArray(body[key])) {
      update[key] = normalizeAttorneyCredentials(body[key] as string[])
      continue
    }
    update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('attorney_listings')
    .update(update)
    .eq('id', listingId)
    .select(LISTING_SELECT)
    .single()

  if (error) {
    console.error('[attorney/listing PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ listing: data })
}
