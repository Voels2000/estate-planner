import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { applyTaxRollover } from '@/lib/tax/admin/applyTaxRollover'
import type { TaxRolloverDraft } from '@/lib/tax/admin/types'

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  let body: {
    draft?: TaxRolloverDraft
    overwrite?: boolean
    acknowledgedManualVerify?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.draft?.sourceYear || !body.draft?.targetYear || !body.draft?.payload) {
    return NextResponse.json({ error: 'draft is required' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const result = await applyTaxRollover(admin, {
      draft: body.draft,
      appliedBy: auth.userId,
      overwrite: Boolean(body.overwrite),
      acknowledgedManualVerify: Boolean(body.acknowledgedManualVerify),
    })
    return NextResponse.json({ data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Apply failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
