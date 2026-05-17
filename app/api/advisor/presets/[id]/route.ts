/**
 * Single advisor preset — update or delete.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  clearAdvisorPresetDefaults,
  getAdvisorPresetById,
  presetPayloadFromInput,
  validatePresetAssumptionRanges,
  type PresetAssumptionInput,
} from '@/lib/advisor/advisorPresetAssumptions'
import { requireAdvisorUser } from '@/lib/advisor/requireAdvisorUser'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAdvisorUser()
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const existing = await getAdvisorPresetById(auth.supabase, auth.user.id, id)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = (await request.json()) as PresetAssumptionInput
  const scenarioName = (body.scenario_name ?? body.scenarioName ?? existing.scenario_name).trim()
  if (!scenarioName) {
    return NextResponse.json({ error: 'scenario_name required' }, { status: 400 })
  }

  const rangeErrors = validatePresetAssumptionRanges(body)
  if (rangeErrors.length > 0) {
    return NextResponse.json({ error: rangeErrors.join('; ') }, { status: 422 })
  }

  const settingDefault = body.is_default === true

  try {
    if (settingDefault) {
      await clearAdvisorPresetDefaults(auth.supabase, auth.user.id)
    }

    const patch = presetPayloadFromInput(auth.user.id, { ...body, scenario_name: scenarioName }, {
      is_default: body.is_default ?? existing.is_default,
    })

    const { data, error } = await auth.supabase
      .from('advisor_projection_assumptions')
      .update({
        scenario_name: patch.scenario_name,
        is_default: patch.is_default,
        return_mean_pct: body.returnMeanPct !== undefined ? patch.return_mean_pct : existing.return_mean_pct,
        volatility_pct: body.volatilityPct !== undefined ? patch.volatility_pct : existing.volatility_pct,
        withdrawal_rate_pct:
          body.withdrawalRatePct !== undefined ? patch.withdrawal_rate_pct : existing.withdrawal_rate_pct,
        success_threshold:
          body.successThreshold !== undefined ? patch.success_threshold : existing.success_threshold,
        simulation_count:
          body.simulationCount !== undefined ? patch.simulation_count : existing.simulation_count,
        planning_horizon_yr:
          body.planningHorizonYr !== undefined ? patch.planning_horizon_yr : existing.planning_horizon_yr,
        inflation_rate_pct:
          body.inflationRatePct !== undefined ? patch.inflation_rate_pct : existing.inflation_rate_pct,
        notes: body.notes !== undefined ? patch.notes : existing.notes,
      })
      .eq('id', id)
      .eq('advisor_id', auth.user.id)
      .eq('is_preset', true)
      .select()
      .single()

    if (error) {
      const message = error.message.includes('advisor_projection_assumptions_one_default')
        ? 'Only one default preset is allowed per advisor.'
        : error.message
      return NextResponse.json({ error: message }, { status: 500 })
    }

    return NextResponse.json({ preset: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdvisorUser()
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const existing = await getAdvisorPresetById(auth.supabase, auth.user.id, id)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await auth.supabase
    .from('advisor_projection_assumptions')
    .delete()
    .eq('id', id)
    .eq('advisor_id', auth.user.id)
    .eq('is_preset', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
