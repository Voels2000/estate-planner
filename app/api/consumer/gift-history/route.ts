import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  afterHouseholdWrite,
  requireOwnedHouseholdId,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'

/** Values used by GiftingDashboard and calculate_gifting_summary (annual vs lifetime). */
const GIFT_TYPES = ['annual', 'lifetime', '529', 'medical', 'tuition'] as const

const GIFT_HISTORY_SELECT =
  'id, household_id, owner_id, tax_year, donor_person, recipient_name, recipient_relationship, amount, gift_type, form_709_filed, notes, created_at'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

async function verifyGiftHistoryOwnership(
  supabase: ServerSupabase,
  userId: string,
  giftId: string,
): Promise<{ householdId: string } | null> {
  const householdId = await resolveOwnedHouseholdId(supabase, userId)
  if (!householdId) return null

  const { data } = await supabase
    .from('gift_history')
    .select('id, household_id')
    .eq('id', giftId)
    .eq('household_id', householdId)
    .eq('owner_id', userId)
    .maybeSingle()

  return data ? { householdId } : null
}

function parseGiftType(raw: unknown): (typeof GIFT_TYPES)[number] | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  return (GIFT_TYPES as readonly string[]).includes(value) ? (value as (typeof GIFT_TYPES)[number]) : null
}

function revalidateGiftingPaths() {
  revalidatePath('/my-estate-trust-strategy')
  revalidatePath('/my-estate-strategy')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const taxYear = Number(body.tax_year)
  const amount = Number(body.amount)
  const recipientName =
    (typeof body.recipient_name === 'string' ? body.recipient_name : body.recipient)?.trim() ?? ''
  const giftType = parseGiftType(body.gift_type)

  if (!Number.isFinite(taxYear) || taxYear < 1900 || taxYear > 2100) {
    return NextResponse.json({ error: 'tax_year required' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'amount required' }, { status: 400 })
  }
  if (!recipientName) {
    return NextResponse.json({ error: 'recipient_name required' }, { status: 400 })
  }
  if (!giftType) {
    return NextResponse.json(
      { error: `gift_type must be one of: ${GIFT_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const { data, error } = await supabase
    .from('gift_history')
    .insert({
      household_id: owned.householdId,
      owner_id: user.id,
      tax_year: taxYear,
      donor_person:
        typeof body.donor_person === 'string' && body.donor_person.trim()
          ? body.donor_person.trim()
          : 'person1',
      recipient_name: recipientName,
      recipient_relationship:
        typeof body.recipient_relationship === 'string' ? body.recipient_relationship.trim() : '',
      amount,
      gift_type: giftType,
      form_709_filed: Boolean(body.form_709_filed),
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    })
    .select(GIFT_HISTORY_SELECT)
    .single()

  if (error) {
    console.error('[gift-history:post]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, owned.householdId)
  revalidateGiftingPaths()
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const access = await verifyGiftHistoryOwnership(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updatePayload: Record<string, unknown> = {}

  if (body.tax_year != null) {
    const taxYear = Number(body.tax_year)
    if (!Number.isFinite(taxYear) || taxYear < 1900 || taxYear > 2100) {
      return NextResponse.json({ error: 'Invalid tax_year' }, { status: 400 })
    }
    updatePayload.tax_year = taxYear
  }

  if (body.amount != null) {
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    updatePayload.amount = amount
  }

  if (body.notes !== undefined) {
    updatePayload.notes =
      typeof body.notes === 'string' ? body.notes.trim() || null : null
  }

  if (body.recipient_name !== undefined || body.recipient !== undefined) {
    const recipientName =
      (typeof body.recipient_name === 'string' ? body.recipient_name : body.recipient)?.trim() ?? ''
    if (!recipientName) {
      return NextResponse.json({ error: 'recipient_name cannot be empty' }, { status: 400 })
    }
    updatePayload.recipient_name = recipientName
  }

  if (body.gift_type != null) {
    const giftType = parseGiftType(body.gift_type)
    if (!giftType) {
      return NextResponse.json(
        { error: `gift_type must be one of: ${GIFT_TYPES.join(', ')}` },
        { status: 400 },
      )
    }
    updatePayload.gift_type = giftType
  }

  if (body.donor_person !== undefined) {
    updatePayload.donor_person =
      typeof body.donor_person === 'string' ? body.donor_person.trim() : 'person1'
  }

  if (body.recipient_relationship !== undefined) {
    updatePayload.recipient_relationship =
      typeof body.recipient_relationship === 'string' ? body.recipient_relationship.trim() : ''
  }

  if (body.form_709_filed !== undefined) {
    updatePayload.form_709_filed = Boolean(body.form_709_filed)
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('gift_history')
    .update(updatePayload)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select(GIFT_HISTORY_SELECT)
    .single()

  if (error) {
    console.error('[gift-history:patch]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, access.householdId)
  revalidateGiftingPaths()
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const access = await verifyGiftHistoryOwnership(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('gift_history')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[gift-history:delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, access.householdId)
  revalidateGiftingPaths()
  return NextResponse.json({ success: true })
}
