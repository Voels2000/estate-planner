import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type ChecklistInsert = {
  analysis_id: string
  user_id: string
  category: string
  item_key: string
  label: string
  description: string
  priority: 'high' | 'standard'
}

async function assertAccessToUser(
  supabase: SupabaseClient,
  sessionUserId: string,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (targetUserId === sessionUserId) {
    return { ok: true }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', sessionUserId)
    .single()

  if (profile?.role !== 'advisor') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', sessionUserId)
    .eq('client_id', targetUserId)
    .maybeSingle()

  if (!link) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const {
    user_id,
    household_id,
    claimed_domicile_state,
    states,
    drivers_license_state,
    voter_registration_state,
    vehicle_registration_state,
    primary_home_titled_state,
    spouse_children_state,
    estate_docs_declare_state,
    business_interests_state,
    files_taxes_in_state,
  } = body

  const effectiveUserId = (user_id as string | undefined) ?? user.id

  const access = await assertAccessToUser(supabase, user.id, effectiveUserId)
  if (!access.ok) return access.response
  let resolvedHouseholdId = (household_id as string | null | undefined) ?? null
  if (!resolvedHouseholdId) {
    const { data: household } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', effectiveUserId)
      .maybeSingle()
    resolvedHouseholdId = household?.id ?? null
  }

  const { data: analysis, error: insertError } = await supabase
    .from('domicile_analysis')
    .insert({
      user_id: effectiveUserId,
      household_id: resolvedHouseholdId,
      claimed_domicile_state,
      states: states ?? [],
      drivers_license_state: drivers_license_state ?? null,
      voter_registration_state: voter_registration_state ?? null,
      vehicle_registration_state: vehicle_registration_state ?? null,
      primary_home_titled_state: primary_home_titled_state ?? null,
      spouse_children_state: spouse_children_state ?? null,
      estate_docs_declare_state: estate_docs_declare_state ?? null,
      business_interests_state: business_interests_state ?? null,
      files_taxes_in_state: files_taxes_in_state ?? null,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { data: scoreResult, error: scoreError } = await supabase.rpc(
    'calculate_domicile_risk',
    { analysis_id: analysis.id }
  )

  if (scoreError) {
    return NextResponse.json({ error: scoreError.message }, { status: 500 })
  }

  const checklistItems = generateChecklistItems(
    analysis.id,
    effectiveUserId,
    body
  )

  if (checklistItems.length > 0) {
    const { error: checklistError } = await supabase
      .from('domicile_checklist_items')
      .insert(checklistItems)

    if (checklistError) {
      return NextResponse.json({ error: checklistError.message }, { status: 500 })
    }
  }

  const { data: finalAnalysis } = await supabase
    .from('domicile_analysis')
    .select('*')
    .eq('id', analysis.id)
    .single()

  return NextResponse.json({ analysis: finalAnalysis, score: scoreResult })
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  const targetUserId = clientId ?? user.id

  const access = await assertAccessToUser(supabase, user.id, targetUserId)
  if (!access.ok) return access.response

  const { data, error } = await supabase
    .from('domicile_analysis')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ analysis: data ?? null })
}

function generateChecklistItems(
  analysisId: string,
  userId: string,
  inputs: Record<string, unknown>
): ChecklistInsert[] {
  const claimed = inputs.claimed_domicile_state as string | undefined
  if (!claimed) {
    return []
  }

  const items: ChecklistInsert[] = []

  const add = (
    category: string,
    item_key: string,
    label: string,
    description: string,
    priority: 'high' | 'standard' = 'standard'
  ) => {
    items.push({
      analysis_id: analysisId,
      user_id: userId,
      category,
      item_key,
      label,
      description,
      priority,
    })
  }

  const dl = inputs.drivers_license_state as string | undefined
  if (dl && dl !== claimed) {
    add(
      'government_records',
      'drivers_license',
      `Obtain a ${claimed} driver's license`,
      `Surrender your ${dl} license and obtain one in ${claimed}.`,
      'high'
    )
  }

  const vr = inputs.voter_registration_state as string | undefined
  if (vr && vr !== claimed) {
    add(
      'government_records',
      'voter_registration',
      `Register to vote in ${claimed}`,
      `Cancel your ${vr} registration and register in ${claimed}.`,
      'high'
    )
  }

  const veh = inputs.vehicle_registration_state as string | undefined
  if (veh && veh !== claimed) {
    add(
      'government_records',
      'vehicle_registration',
      `Register vehicles in ${claimed}`,
      `Transfer vehicle registrations from ${veh} to ${claimed}.`,
      'standard'
    )
  }

  const estate = inputs.estate_docs_declare_state as string | undefined
  if (estate && estate !== claimed) {
    add(
      'legal_docs',
      'update_will',
      `Update will and trust to declare ${claimed} domicile`,
      `Ensure your will, trust, and powers of attorney explicitly state ${claimed} as your domicile.`,
      'high'
    )
  }

  const tax = inputs.files_taxes_in_state as string | undefined
  if (tax && tax !== claimed) {
    add(
      'financial',
      'file_taxes',
      `File state tax returns in ${claimed}`,
      `Begin filing state income tax returns in ${claimed} and cease filing as a resident in ${tax}.`,
      'high'
    )
  }

  const home = inputs.primary_home_titled_state as string | undefined
  if (home && home !== claimed) {
    add(
      'financial',
      'homestead_exemption',
      `Apply for homestead exemption in ${claimed}`,
      `If available, apply for the homestead exemption in ${claimed} to reinforce domicile intent.`,
      'standard'
    )
  }

  const family = inputs.spouse_children_state as string | undefined
  if (family && family !== claimed) {
    add(
      'physical_presence',
      'family_ties',
      `Address family ties in ${claimed}`,
      `Courts weigh spouse and minor children location heavily. Document family presence in ${claimed}.`,
      'high'
    )
  }

  add(
    'social_ties',
    'local_affiliations',
    `Join local organizations in ${claimed}`,
    `Membership in clubs, religious groups, or charities in ${claimed} supports domicile intent.`,
    'standard'
  )

  add(
    'physical_presence',
    'travel_base',
    `Use ${claimed} as your travel base`,
    `When travelling, depart from and return to ${claimed}. Make major purchases there when possible.`,
    'standard'
  )

  add(
    'financial',
    'bank_accounts',
    `Maintain primary bank accounts in ${claimed}`,
    `Ensure your primary checking and investment accounts list your ${claimed} address.`,
    'standard'
  )

  return items
}
