/**
 * Advisor Monte Carlo assumption presets (is_preset = true).
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  clearAdvisorPresetDefaults,
  presetPayloadFromInput,
  validatePresetAssumptionRanges,
  type PresetAssumptionInput,
} from '@/lib/advisor/advisorPresetAssumptions'
import { requireAdvisorUser } from '@/lib/advisor/requireAdvisorUser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdvisorUser()
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('advisor_projection_assumptions')
    .select('*')
    .eq('advisor_id', auth.user.id)
    .eq('is_preset', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ presets: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdvisorUser()
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as PresetAssumptionInput
  const scenarioName = (body.scenario_name ?? body.scenarioName ?? '').trim()
  if (!scenarioName) {
    return NextResponse.json({ error: 'scenario_name required' }, { status: 400 })
  }

  const rangeErrors = validatePresetAssumptionRanges(body)
  if (rangeErrors.length > 0) {
    return NextResponse.json({ error: rangeErrors.join('; ') }, { status: 422 })
  }

  try {
    if (body.is_default) {
      await clearAdvisorPresetDefaults(auth.supabase, auth.user.id)
    }

    const { data, error } = await auth.supabase
      .from('advisor_projection_assumptions')
      .insert(presetPayloadFromInput(auth.user.id, { ...body, scenario_name: scenarioName }))
      .select()
      .single()

    if (error) {
      const message = error.message.includes('advisor_projection_assumptions_one_default')
        ? 'Only one default preset is allowed per advisor. Clear the existing default and try again.'
        : error.message
      return NextResponse.json({ error: message }, { status: 500 })
    }

    return NextResponse.json({ preset: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 },
    )
  }
}
