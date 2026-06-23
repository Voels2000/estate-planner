// app/api/export-estate-plan/route.ts

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { hasDeliverableDownloadAccess, hasDeliverableUpdateAccess } from '@/lib/access/requirePaidDownloadAccess'
import {
  getUserPlanExportPurchase,
  toPlanExportPurchaseContext,
} from '@/lib/billing/oneTimePurchases'
import { requireVaultHouseholdAccess } from '@/lib/api/requireVaultAccess'
import { parseHouseholdIdParam } from '@/lib/api/schemas/householdAccess'
import { loadEstatePlanPdfTaxPayload } from '@/lib/export/loadEstatePlanPdfTaxPayload'
import { createAdminClient } from '@/lib/supabase/admin'
import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = parseHouseholdIdParam(searchParams.get('household_id'))
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const householdId = parsed.householdId

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

    const planExportPurchase = toPlanExportPurchaseContext(
      await getUserPlanExportPurchase(createAdminClient(), user.id),
    )

    const accessOptions = { planExportPurchase }

    if (!hasDeliverableUpdateAccess(profile, DELIVERABLE_MIN_TIER, accessOptions)) {
      const downloadOnly =
        planExportPurchase &&
        hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER, accessOptions)
      return NextResponse.json(
        {
          error: downloadOnly
            ? 'Plan editing window ended — subscribe to update your estate plan PDF'
            : 'Paid active Tier 3 subscription or Plan & Export purchase required for PDF export',
        },
        { status: 403 },
      )
    }

    const isAdvisor = profile.role === 'advisor'
    const variant = searchParams.get('variant') ?? null
    const isAttorneyVariant = variant === 'attorney'

    const access = await requireVaultHouseholdAccess(
      supabase,
      user.id,
      householdId,
      profile.role,
    )
    if (!access.ok) return access.response

    const householdResult = await supabase
      .from('households')
      .select(`
          id, owner_id, name, filing_status, state_primary, has_spouse,
          estate_complexity_score, estate_complexity_flag,
          last_recommendation_at,
          person1_first_name, person1_last_name,
          person2_first_name, person2_last_name
        `)
      .eq('id', householdId)
      .single()

    if (householdResult.error || !householdResult.data) {
      return NextResponse.json(
        { error: householdResult.error?.message ?? 'Household not found' },
        { status: 404 },
      )
    }

    const clientOwnerId = householdResult.data.owner_id as string

    // Client Summary + attorney intake PDFs need household profile figures (tax + assets).
    const includeFinancialProfile =
      isAdvisor || isAttorneyVariant || profile.role === 'consumer'

    // Run all data fetches in parallel
    const [
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
        .eq('owner_id', clientOwnerId),

      // 10. Beneficiary conflicts (for attorney variant)
      supabase
        .from('beneficiary_conflicts')
        .select('conflict_type, severity, description, recommended_action')
        .eq('household_id', householdId),

      // 11. Assets summary (for attorney variant gross estate)
      supabase
        .from('assets')
        .select('type, value')
        .eq('owner_id', clientOwnerId),
    ])

    // Collect any errors
    const errors: string[] = []
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