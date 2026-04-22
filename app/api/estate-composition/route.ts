// app/api/estate-composition/route.ts
// POST /api/estate-composition
// Body: { householdId: string }
// Returns: EstateComposition JSON
//
// Called by EstateCompositionCard on consumer dashboard,
// My Estate Strategy page, and advisor EstateTab.
// Auth-gated — requires an authenticated Supabase session.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { householdId?: string }
    const { householdId } = body

    if (!householdId) {
      return NextResponse.json(
        { success: false, error: 'householdId is required' },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const composition = await classifyEstateAssets(supabase, householdId)

    return NextResponse.json(composition)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[/api/estate-composition] error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
