import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  afterHouseholdWrite,
  requireOwnedHouseholdId,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'
import {
  ATG_SELECT,
  parseAtgAmount,
  parseAtgGiftYear,
} from '@/lib/gifting/adjustedTaxableGifts'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

async function verifyAtgOwnership(
  supabase: ServerSupabase,
  userId: string,
  rowId: string,
): Promise<{ householdId: string } | null> {
  const householdId = await resolveOwnedHouseholdId(supabase, userId)
  if (!householdId) return null

  const { data } = await supabase
    .from('adjusted_taxable_gifts')
    .select('id, household_id')
    .eq('id', rowId)
    .eq('household_id', householdId)
    .maybeSingle()

  return data ? { householdId } : null
}

function revalidateAtgPaths() {
  revalidatePath('/my-estate-trust-strategy')
  revalidatePath('/my-estate-strategy')
  revalidatePath('/estate-tax')
  revalidatePath('/dashboard')
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const { data, error } = await supabase
    .from('adjusted_taxable_gifts')
    .select(ATG_SELECT)
    .eq('household_id', owned.householdId)
    .order('gift_year', { ascending: false })

  if (error) {
    console.error('[adjusted-taxable-gifts:get]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const giftYear = parseAtgGiftYear(body.gift_year)
  const amount = parseAtgAmount(body.amount)
  if (giftYear == null) {
    return NextResponse.json({ error: 'gift_year must be 1977–2100' }, { status: 400 })
  }
  if (amount == null) {
    return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 })
  }

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const { data, error } = await supabase
    .from('adjusted_taxable_gifts')
    .insert({
      household_id: owned.householdId,
      gift_year: giftYear,
      amount,
      recipient_description:
        typeof body.recipient_description === 'string' ? body.recipient_description.trim() || null : null,
      three_year_clawback: Boolean(body.three_year_clawback),
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    })
    .select(ATG_SELECT)
    .single()

  if (error) {
    console.error('[adjusted-taxable-gifts:post]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, owned.householdId)
  revalidateAtgPaths()
  return NextResponse.json(data, { status: 201 })
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

  const access = await verifyAtgOwnership(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updatePayload: Record<string, unknown> = {}

  if (body.gift_year != null) {
    const giftYear = parseAtgGiftYear(body.gift_year)
    if (giftYear == null) {
      return NextResponse.json({ error: 'Invalid gift_year' }, { status: 400 })
    }
    updatePayload.gift_year = giftYear
  }

  if (body.amount != null) {
    const amount = parseAtgAmount(body.amount)
    if (amount == null) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    updatePayload.amount = amount
  }

  if (body.recipient_description !== undefined) {
    updatePayload.recipient_description =
      typeof body.recipient_description === 'string' ? body.recipient_description.trim() || null : null
  }

  if (body.three_year_clawback !== undefined) {
    updatePayload.three_year_clawback = Boolean(body.three_year_clawback)
  }

  if (body.notes !== undefined) {
    updatePayload.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('adjusted_taxable_gifts')
    .update(updatePayload)
    .eq('id', id)
    .select(ATG_SELECT)
    .single()

  if (error) {
    console.error('[adjusted-taxable-gifts:patch]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, access.householdId)
  revalidateAtgPaths()
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

  const access = await verifyAtgOwnership(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('adjusted_taxable_gifts').delete().eq('id', id)

  if (error) {
    console.error('[adjusted-taxable-gifts:delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, access.householdId)
  revalidateAtgPaths()
  return NextResponse.json({ success: true })
}
