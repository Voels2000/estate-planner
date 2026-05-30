import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, clientIp } from '@/lib/api/simpleRateLimit'

const RATE_MAX = 120
const RATE_WINDOW_MS = 60 * 1000

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
  const ip = clientIp(req)
  const rl = checkRateLimit(`horizon-telemetry:${ip}`, RATE_MAX, RATE_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rl.retryAfterSec ? { 'Retry-After': String(rl.retryAfterSec) } : {} },
    )
  }

  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore
    .getAll()
    .some(({ name }) => name.includes('-auth-token'))
  if (!hasAuthCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
