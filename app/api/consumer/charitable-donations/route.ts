import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite } from '@/lib/consumer/afterHouseholdWrite'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    household_id,
    tax_year,
    vehicle_type,
    donor_person,
    organization_name,
    amount,
    fmv_at_donation,
    cost_basis,
    deductible_amount,
    is_qcd,
    ira_account_label,
    notes,
  } = body

  if (!household_id || !organization_name || amount == null) {
    return NextResponse.json(
      { error: 'household_id, organization_name, and amount required' },
      { status: 400 },
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('id', household_id)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!household) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('charitable_donations')
    .insert({
      household_id,
      owner_id: user.id,
      tax_year: tax_year ?? new Date().getFullYear(),
      vehicle_type: vehicle_type ?? 'cash',
      donor_person: donor_person ?? 'person1',
      organization_name,
      amount: Number(amount),
      fmv_at_donation: fmv_at_donation != null ? Number(fmv_at_donation) : null,
      cost_basis: cost_basis != null ? Number(cost_basis) : null,
      deductible_amount: deductible_amount != null ? Number(deductible_amount) : null,
      is_qcd: Boolean(is_qcd),
      ira_account_label: ira_account_label ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[charitable-donations:post]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, household_id)
  revalidatePath('/my-estate-trust-strategy')
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, household_id } = body

  if (!id || !household_id) {
    return NextResponse.json({ error: 'id and household_id required' }, { status: 400 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('id', household_id)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!household) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('charitable_donations')
    .delete()
    .eq('id', id)
    .eq('household_id', household_id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[charitable-donations:delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, household_id)
  revalidatePath('/my-estate-trust-strategy')
  return NextResponse.json({ success: true })
}
