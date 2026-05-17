/**
 * Set one advisor preset as the default (clears other defaults first).
 */
import { NextResponse } from 'next/server'
import { clearAdvisorPresetDefaults, getAdvisorPresetById } from '@/lib/advisor/advisorPresetAssumptions'
import { requireAdvisorUser } from '@/lib/advisor/requireAdvisorUser'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, context: RouteContext) {
  const auth = await requireAdvisorUser()
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const existing = await getAdvisorPresetById(auth.supabase, auth.user.id, id)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await clearAdvisorPresetDefaults(auth.supabase, auth.user.id)

    const { data, error } = await auth.supabase
      .from('advisor_projection_assumptions')
      .update({ is_default: true })
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
