import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_SURFACES = new Set([
  'advisor_tax_tab_current_law',
  'consumer_trust_strategy_context',
  'advisor_strategy_tab_today',
] as const)

type AllowedSurface =
  | 'advisor_tax_tab_current_law'
  | 'consumer_trust_strategy_context'
  | 'advisor_strategy_tab_today'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      surface?: string
      householdId?: string | null
      missingFields?: string[]
      lawScenario?: string | null
    }

    const surface = body?.surface
    if (!surface || !ALLOWED_SURFACES.has(surface as AllowedSurface)) {
      return NextResponse.json({ error: 'Invalid surface' }, { status: 400 })
    }

    const payload = {
      ts: new Date().toISOString(),
      surface,
      householdId: body?.householdId ?? null,
      lawScenario: body?.lawScenario ?? null,
      missingFields: Array.isArray(body?.missingFields) ? body.missingFields : [],
    }

    console.error('[horizon-input-missing]', payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[horizon-input-missing:route]', error)
    return NextResponse.json({ error: 'Invalid telemetry payload' }, { status: 400 })
  }
}
