// app/api/export-estate-plan/route.ts

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { hasPaidDownloadAccess } from '@/lib/access/requirePaidDownloadAccess'
import { assertHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { loadEstatePlanPdfTaxPayload } from '@/lib/export/loadEstatePlanPdfTaxPayload'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('household_id')

    if (!householdId) {
      return NextResponse.json({ error: 'household_id is required' }, { status: 400 })
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the user has access to this household (advisor or owner)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, consumer_tier, subscription_status, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Download policy: trial users cannot export. Consumers must be paid-active.
    if (!hasPaidDownloadAccess(profile, 3)) {
      return NextResponse.json(
        { error: 'Paid active Tier 3 subscription required for PDF export' },
        { status: 403 },
      )
    }

    const isAdvisor = profile.role === 'advisor'
    const variant = searchParams.get('variant') ?? null
    const isAttorneyVariant = variant === 'attorney'

    const access = await assertHouseholdAccess(supabase, user.id, householdId)
    if (!access.ok) {
      return NextResponse.json(
        { error: access.reason === 'not_found' ? 'Household not found' : 'Forbidden' },
        { status: access.reason === 'not_found' ? 404 : 403 },
      )
    }

    // Client Summary + attorney intake PDFs need household profile figures (tax + assets).
    const includeFinancialProfile =
      isAdvisor || isAttorneyVariant || profile.role === 'consumer'

    // Run all data fetches in parallel
    const [
      householdResult,
      completenessResult,
      estateReadinessResult,
      recommendationsResult,
      incapacityResult,
      documentsResult,
      trustsResult,
      beneficiariesResult,
      conflictsResult,
      assetsSummaryResult,
    ] = await Promise.all([
      // 1. Household + profile data
      supabase
        .from('households')
        .select(`
          id, name, filing_status, state_primary, has_spouse,
          estate_complexity_score, estate_complexity_flag,
          last_recommendation_at,
          person1_first_name, person1_last_name,
          person2_first_name, person2_last_name
        `)
        .eq('id', householdId)
        .single(),

      // 2. Completeness score (advisor / attorney intake)
      supabase.rpc('calculate_estate_completeness', { p_household_id: householdId }),

      // 2b. Estate readiness (consumer-facing 0–100)
      supabase
        .from('estate_health_scores')
        .select('score')
        .eq('household_id', householdId)
        .maybeSingle(),

      // 3. Estate recommendations
      supabase
        .from('estate_recommendations')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // 4. Incapacity recommendations
      supabase.rpc('generate_incapacity_recommendations', { p_household_id: householdId }),

      // 5. Estate documents on file
      supabase
        .from('estate_documents')
        .select('document_type, status, signed_date, notes')
        .eq('household_id', householdId),

      // 8. Trusts on file
      supabase
        .from('trusts')
        .select('trust_type, trustee_name, successor_trustee, established_date, notes')
        .eq('household_id', householdId),

      // 9. Asset beneficiaries
      supabase
        .from('asset_beneficiaries')
        .select('beneficiary_name, relationship, allocation_pct, special_needs, distribution_age, is_minor')
        .eq('owner_id', user.id),

      // 10. Beneficiary conflicts (for attorney variant)
      supabase
        .from('beneficiary_conflicts')
        .select('conflict_type, severity, description, recommended_action')
        .eq('household_id', householdId),

      // 11. Assets summary (for attorney variant gross estate)
      supabase
        .from('assets')
        .select('type, value')
        .eq('owner_id', user.id),
    ])

    // Collect any errors
    const errors: string[] = []
    if (householdResult.error) errors.push(`household: ${householdResult.error.message}`)
    if (completenessResult.error) errors.push(`completeness: ${completenessResult.error.message}`)
    if (recommendationsResult.error && recommendationsResult.error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      errors.push(`recommendations: ${recommendationsResult.error.message}`)
    }
    if (incapacityResult.error) errors.push(`incapacity: ${incapacityResult.error.message}`)

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Data fetch errors', details: errors }, { status: 500 })
    }

    let pdfTaxPayload: Awaited<ReturnType<typeof loadEstatePlanPdfTaxPayload>> | null = null
    if (includeFinancialProfile && householdResult.data) {
      try {
        pdfTaxPayload = await loadEstatePlanPdfTaxPayload(supabase, householdId, householdResult.data)
      } catch (taxErr) {
        console.error('[export-estate-plan] Engine B tax payload failed:', taxErr)
        return NextResponse.json({ error: 'Tax calculation failed' }, { status: 500 })
      }
    }

    // Assemble the payload
    const payload = {
      generated_at: new Date().toISOString(),
      role: profile.role,
      consumer_tier: profile.consumer_tier,
      advisor_name: isAdvisor ? (profile.full_name ?? null) : null,
      prepared_by_name: profile.full_name ?? null,
      variant: variant ?? null,
      household: householdResult.data,
      completeness: completenessResult.data,
      estate_readiness_score: estateReadinessResult.data?.score ?? null,
      recommendations: recommendationsResult.data ?? null,
      incapacity: incapacityResult.data,
      federal_estate_tax: pdfTaxPayload?.federal_estate_tax ?? null,
      state_estate_tax: pdfTaxPayload?.state_estate_tax ?? null,
      documents: documentsResult.data ?? [],
      trusts: trustsResult.data ?? [],
      beneficiaries: beneficiariesResult.data ?? [],
      // Attorney variant extras
      conflicts: isAttorneyVariant ? (conflictsResult.data ?? []) : [],
      assets_summary: includeFinancialProfile ? (assetsSummaryResult.data ?? []) : [],
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[export-estate-plan] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}