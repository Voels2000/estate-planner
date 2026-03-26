// app/api/export-estate-plan/route.ts

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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
      .select('role, consumer_tier, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Consumers must be Tier 3+ to export
    if (profile.role === 'consumer' && profile.consumer_tier < 3) {
      return NextResponse.json({ error: 'Tier 3 subscription required for PDF export' }, { status: 403 })
    }

    const isAdvisor = profile.role === 'advisor'

    // Run all data fetches in parallel
    const [
      householdResult,
      completenessResult,
      recommendationsResult,
      incapacityResult,
      estateTaxResult,
      stateTaxResult,
      documentsResult,
      trustsResult,
      beneficiariesResult,
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

      // 2. Completeness score
      supabase.rpc('calculate_estate_completeness', { p_household_id: householdId }),

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

      // 5. Federal estate tax (advisor only)
      isAdvisor
        ? supabase.rpc('calculate_federal_estate_tax', { p_household_id: householdId })
        : Promise.resolve({ data: null, error: null }),

      // 6. State estate tax (advisor only)
      isAdvisor
        ? supabase.rpc('calculate_state_estate_tax', { p_household_id: householdId })
        : Promise.resolve({ data: null, error: null }),

      // 7. Estate documents on file
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
    if (estateTaxResult.error) errors.push(`federal_tax: ${estateTaxResult.error.message}`)
    if (stateTaxResult.error) errors.push(`state_tax: ${stateTaxResult.error.message}`)

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Data fetch errors', details: errors }, { status: 500 })
    }

    // Assemble the payload
    const payload = {
      generated_at: new Date().toISOString(),
      role: profile.role,
      consumer_tier: profile.consumer_tier,
      advisor_name: isAdvisor ? (profile.full_name ?? null) : null,
      household: householdResult.data,
      completeness: completenessResult.data,
      recommendations: recommendationsResult.data ?? null,
      incapacity: incapacityResult.data,
      // Tax data: only included for advisors
      federal_estate_tax: isAdvisor ? estateTaxResult.data : null,
      state_estate_tax: isAdvisor ? stateTaxResult.data : null,
      documents: documentsResult.data ?? [],
      trusts: trustsResult.data ?? [],
      beneficiaries: beneficiariesResult.data ?? [],
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[export-estate-plan] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}