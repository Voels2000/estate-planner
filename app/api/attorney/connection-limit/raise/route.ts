import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import {
  applyAttorneyConnectionLimitRaise,
  hasActiveAttorneyBillingSubscription,
} from '@/lib/billing/attorneyConnectionStickyFloor'
import { validateRaiseClientLimit } from '@/lib/billing/firmConnectionStickyFloor'
import { syncAttorneyConnectionBillingQuantity } from '@/lib/billing/attorneyConnectionBilling'
import { attorneyConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import { buildAttorneyRaiseLimitPreview } from '@/lib/billing/attorneyConnectionBillingSummary'
import { rateForCount, ATTORNEY_BANDS, ATTORNEY_FLOOR } from '@/lib/pricing/connectionPricing'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isConnectionBillingEnabled()) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const listingId = await getAttorneyListingIdForUser(supabase, ctx.user.id)
  if (!listingId) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const raw = body.new_client_limit ?? body.newLimit
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return NextResponse.json({ error: 'new_client_limit is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: listing } = await admin
    .from('attorney_listings')
    .select('client_limit, profile_id')
    .eq('id', listingId)
    .single()

  if (!listing?.profile_id) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status')
    .eq('id', listing.profile_id)
    .single()

  if (!hasActiveAttorneyBillingSubscription(profile?.subscription_status)) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
  }

  const validation = validateRaiseClientLimit({
    currentLimit: listing.client_limit,
    newLimit: raw,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    await applyAttorneyConnectionLimitRaise(admin, listingId, raw)
    await syncAttorneyConnectionBillingQuantity(listingId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Raise failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const newLimit = Math.floor(raw)
  const newRate = rateForCount(newLimit, ATTORNEY_BANDS, ATTORNEY_FLOOR)
  return NextResponse.json({
    success: true,
    client_limit: newLimit,
    rate_per_client: newRate,
    monthly_estimate: newRate * newLimit,
  })
}

export async function GET(request: Request) {
  if (!isConnectionBillingEnabled()) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const listingId = await getAttorneyListingIdForUser(supabase, ctx.user.id)
  if (!listingId) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  const url = new URL(request.url)
  const raw = url.searchParams.get('new_client_limit')
  const newLimit = raw ? Number(raw) : NaN
  if (!Number.isFinite(newLimit)) {
    return NextResponse.json({ error: 'new_client_limit query param required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const connected = await attorneyConnectedHouseholds(admin, listingId)
  const { data: listing } = await admin
    .from('attorney_listings')
    .select('client_limit, billing_floor')
    .eq('id', listingId)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  const validation = validateRaiseClientLimit({
    currentLimit: listing.client_limit,
    newLimit,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const preview = buildAttorneyRaiseLimitPreview({
    connectedCount: connected,
    billingFloor: listing.billing_floor,
    newLimit,
  })

  return NextResponse.json({ ...preview, action: 'raise' })
}
