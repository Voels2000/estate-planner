/**
 * Canonical projection API route.
 *
 * Loads household financial inputs + tax rule tables and computes projection
 * rows via `computeCompleteProjection`. Optional query params can override a
 * subset of household assumptions for scenario modeling.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadProjectionData, parseProjectionOverrides } from '@/lib/projections/loadProjectionData'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const overrides = parseProjectionOverrides(request.nextUrl.searchParams)
  const { household, rows } = await loadProjectionData(supabase, user.id, overrides)

  if (!household) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  return NextResponse.json({ rows, household })
}
