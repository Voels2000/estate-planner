import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite, resolveOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'

const ANSWER_KEYS = [
  'has_will',
  'has_trust',
  'has_poa',
  'has_hcd',
  'beneficiaries_current',
] as const

type AnswerKey = (typeof ANSWER_KEYS)[number]
type AnswerValue = 'yes' | 'no'

function parseAnswers(raw: Record<string, unknown>): Record<AnswerKey, boolean> | null {
  const out = {} as Record<AnswerKey, boolean>
  for (const key of ANSWER_KEYS) {
    const val = raw[key]
    if (val !== 'yes' && val !== 'no') return null
    out[key] = val === 'yes'
  }
  return out
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as {
    householdId?: string
    answers?: Record<string, unknown>
  }

  if (!body.answers) {
    return NextResponse.json({ error: 'answers required' }, { status: 400 })
  }

  const parsed = parseAnswers(body.answers)
  if (!parsed) {
    return NextResponse.json({ error: 'All questions must be answered yes or no' }, { status: 400 })
  }

  const ownedId = body.householdId
    ? await resolveOwnedHouseholdId(supabase, user.id, body.householdId)
    : await resolveOwnedHouseholdId(supabase, user.id)

  if (!ownedId) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('estate_health_check').upsert(
    {
      household_id: ownedId,
      has_will: parsed.has_will,
      has_trust: parsed.has_trust,
      has_poa: parsed.has_poa,
      has_hcd: parsed.has_hcd,
      beneficiaries_current: parsed.beneficiaries_current,
      completed_at: now,
      updated_at: now,
    },
    { onConflict: 'household_id' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, ownedId)

  return NextResponse.json({ success: true })
}
