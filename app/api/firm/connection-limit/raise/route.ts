import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import {
  applyFirmConnectionLimitRaise,
  buildRebandPreview,
  validateRaiseClientLimit,
} from '@/lib/billing/firmConnectionStickyFloor'
import { syncFirmConnectionBillingQuantity } from '@/lib/billing/firmConnectionBilling'
import { rateForCount, ADVISOR_BANDS, ADVISOR_FLOOR } from '@/lib/pricing/connectionPricing'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isConnectionBillingEnabled()) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isFirmOwner || !ctx.firm_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const raw = body.new_client_limit ?? body.newLimit
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return NextResponse.json({ error: 'new_client_limit is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: firm } = await admin
    .from('firms')
    .select('client_limit, subscription_status')
    .eq('id', ctx.firm_id)
    .single()

  if (!firm) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  if (firm.subscription_status !== 'active' && firm.subscription_status !== 'trialing') {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
  }

  const validation = validateRaiseClientLimit({
    currentLimit: firm.client_limit,
    newLimit: raw,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    await applyFirmConnectionLimitRaise(admin, ctx.firm_id, raw)
    await syncFirmConnectionBillingQuantity(ctx.firm_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Raise failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const newLimit = Math.floor(raw)
  const newRate = rateForCount(newLimit, ADVISOR_BANDS, ADVISOR_FLOOR)
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
  if (!ctx.isFirmOwner || !ctx.firm_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const raw = url.searchParams.get('new_client_limit')
  const newLimit = raw ? Number(raw) : NaN
  if (!Number.isFinite(newLimit)) {
    return NextResponse.json({ error: 'new_client_limit query param required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: firm } = await admin
    .from('firms')
    .select('client_limit, reset_count')
    .eq('id', ctx.firm_id)
    .single()

  if (!firm) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const preview = buildRebandPreview({
    currentLimit: firm.client_limit ?? 1,
    newLimit,
    connectedCount: 0,
    resetCount: firm.reset_count ?? 0,
  })

  return NextResponse.json({
    ...preview,
    action: 'raise',
  })
}
