import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { buildTaxRolloverDraft } from '@/lib/tax/admin/buildTaxRolloverDraft'

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  let body: { sourceYear?: number; targetYear?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sourceYear = Number(body.sourceYear)
  const targetYear = Number(body.targetYear)
  if (!Number.isFinite(sourceYear) || !Number.isFinite(targetYear)) {
    return NextResponse.json({ error: 'sourceYear and targetYear are required' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const draft = await buildTaxRolloverDraft(admin, sourceYear, targetYear)
    return NextResponse.json({ data: draft })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rollover draft failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
