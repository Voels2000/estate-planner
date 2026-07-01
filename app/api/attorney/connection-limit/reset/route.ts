import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { attorneyConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import {
  applyAttorneyConnectionLimitReset,
} from '@/lib/billing/attorneyConnectionStickyFloor'
import { buildAttorneyRebandPreview } from '@/lib/billing/attorneyConnectionBillingSummary'
import { validateSelfServeReset } from '@/lib/billing/firmConnectionStickyFloor'
import { syncAttorneyConnectionBillingQuantity } from '@/lib/billing/attorneyConnectionBilling'

export const dynamic = 'force-dynamic'

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
  const raw = url.searchParams.get('new_limit')
  const newLimit = raw ? Number(raw) : NaN
  if (!Number.isFinite(newLimit)) {
    return NextResponse.json({ error: 'new_limit query param required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const connected = await attorneyConnectedHouseholds(admin, listingId)
  const { data: listing } = await admin
    .from('attorney_listings')
    .select('client_limit, reset_count')
    .eq('id', listingId)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  const validation = validateSelfServeReset({
    newLimit,
    connectedCount: connected,
    resetCount: listing.reset_count ?? 0,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error, code: validation.code }, { status: 400 })
  }

  const preview = buildAttorneyRebandPreview({
    currentLimit: listing.client_limit ?? 1,
    newLimit,
    connectedCount: connected,
    resetCount: listing.reset_count ?? 0,
  })

  const message =
    `Lowering to ${preview.newLimit} clients moves you from ${preview.oldBandLabel} ` +
    `($${preview.oldRatePerClient}/client) to ${preview.newBandLabel} ` +
    `($${preview.newRatePerClient}/client). New monthly estimate: $${preview.newMonthlyEstimate}. ` +
    `This is reset ${preview.resetCountAfter} of 2 before admin assistance is required.`

  return NextResponse.json({ ...preview, confirmationMessage: message })
}

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
  const raw = body.new_limit ?? body.newLimit
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return NextResponse.json({ error: 'new_limit is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const connected = await attorneyConnectedHouseholds(admin, listingId)
  const { data: listing } = await admin
    .from('attorney_listings')
    .select('client_limit, reset_count')
    .eq('id', listingId)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  const validation = validateSelfServeReset({
    newLimit: raw,
    connectedCount: connected,
    resetCount: listing.reset_count ?? 0,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error, code: validation.code }, { status: 400 })
  }

  try {
    await applyAttorneyConnectionLimitReset(admin, listingId, raw)
    await syncAttorneyConnectionBillingQuantity(listingId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reset failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const preview = buildAttorneyRebandPreview({
    currentLimit: listing.client_limit ?? 1,
    newLimit: raw,
    connectedCount: connected,
    resetCount: listing.reset_count ?? 0,
  })

  return NextResponse.json({ success: true, ...preview })
}
