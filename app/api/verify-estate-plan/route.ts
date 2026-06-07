import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdBody } from '@/lib/api/schemas/householdAccess'
import { runEstateVerification } from '@/lib/verify/runEstateVerification'

export const runtime = 'nodejs'

/** Consumer/advisor self-service plan number verification (read-only). */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = parseHouseholdIdBody(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
    if (!access.ok) return access.response

    const admin = createAdminClient()
    const result = await runEstateVerification(admin, { householdId: parsed.householdId })

    return NextResponse.json({
      passed: result.passed,
      householdId: result.householdId,
      label: result.label,
      statePrimary: result.statePrimary,
      filingStatus: result.filingStatus,
      hasBaseCase: result.hasBaseCase,
      matrix: result.matrix,
      goldenChecks: result.goldenChecks,
      surfaces: result.surfaces,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[verify-estate-plan]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
