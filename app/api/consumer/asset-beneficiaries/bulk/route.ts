import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite, requireOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'
import {
  ASSET_BENEFICIARY_SELECT,
  buildBeneficiaryPayload,
  parseTitlingEntityRef,
  touchBeneficiaryReview,
  verifyTitlingEntityOwnership,
} from '@/lib/titling/assetBeneficiaries'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const items = body.items as Record<string, unknown>[] | undefined
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const created: unknown[] = []
  const errors: string[] = []

  for (const item of items) {
    const parsedRef = parseTitlingEntityRef(item)
    if (!parsedRef.ok) {
      errors.push(parsedRef.error)
      continue
    }
    const built = buildBeneficiaryPayload(item)
    if ('error' in built) {
      errors.push(built.error as string)
      continue
    }
    if (!(await verifyTitlingEntityOwnership(supabase, user.id, parsedRef.ref))) {
      errors.push('Forbidden entity reference')
      continue
    }

    const { data, error } = await supabase
      .from('asset_beneficiaries')
      .insert({
        owner_id: user.id,
        ...parsedRef.ref,
        ...built.fields,
      })
      .select(ASSET_BENEFICIARY_SELECT)
      .single()

    if (error) {
      errors.push(error.message)
    } else if (data) {
      created.push(data)
    }
  }

  if (created.length > 0) {
    await touchBeneficiaryReview(supabase, owned.householdId)
    await afterHouseholdWrite(supabase, owned.householdId)
  }

  return NextResponse.json({ created, errors, appliedCount: created.length })
}
