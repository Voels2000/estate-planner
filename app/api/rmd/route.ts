import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeRmd } from '@/lib/calculations/rmd'

export type RmdApiBody = {
  household_id: string
  owner_birth_year: number
  spouse_birth_year?: number | null
  filing_status: string
  distribution_year: number
  account_balances: { asset_id: string; type: string; balance: number }[]
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RmdApiBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    household_id,
    owner_birth_year,
    spouse_birth_year,
    filing_status,
    distribution_year,
    account_balances,
  } = body

  if (!household_id || owner_birth_year == null || !filing_status || !distribution_year) {
    return NextResponse.json(
      { error: 'Missing required fields: household_id, owner_birth_year, filing_status, distribution_year' },
      { status: 400 }
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('id', household_id)
    .eq('owner_id', user.id)
    .single()

  if (!household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  const result = await computeRmd({
    household_id,
    owner_birth_year,
    spouse_birth_year: spouse_birth_year ?? null,
    filing_status,
    distribution_year,
    account_balances: account_balances ?? [],
  })

  return NextResponse.json(result)
}
