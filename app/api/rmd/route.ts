import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeRmd } from '@/lib/calculations/rmd'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { z } from 'zod'

export type RmdApiBody = {
  household_id: string
  owner_birth_year: number
  spouse_birth_year?: number | null
  filing_status: string
  distribution_year: number
  account_balances: { asset_id: string; type: string; balance: number }[]
}

const rmdBodySchema = z.object({
  household_id: z.string().uuid(),
  owner_birth_year: z.number(),
  spouse_birth_year: z.number().nullable().optional(),
  filing_status: z.string().min(1),
  distribution_year: z.number(),
  account_balances: z
    .array(
      z.object({
        asset_id: z.string(),
        type: z.string(),
        balance: z.number(),
      }),
    )
    .optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = rmdBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
      { status: 400 },
    )
  }

  const body = parsed.data
  const access = await requireHouseholdAccess(supabase, user.id, body.household_id, {
    ownerOnly: true,
  })
  if (!access.ok) return access.response

  const result = await computeRmd({
    household_id: body.household_id,
    owner_birth_year: body.owner_birth_year,
    spouse_birth_year: body.spouse_birth_year ?? null,
    filing_status: body.filing_status,
    distribution_year: body.distribution_year,
    account_balances: body.account_balances ?? [],
  })

  return NextResponse.json(result)
}
