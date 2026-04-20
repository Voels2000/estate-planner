import { getUserAccess } from '@/lib/get-user-access'
import EstatePlanningDashboard from '@/components/EstatePlanningDashboard'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import EstateTaxClient, { type EstateTaxTrustRow } from './_estate-tax-client'

export default async function EstateTaxPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Estate Tax Planner</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Estate Tax Planner"
          valueProposition="Calculate federal and state estate tax exposure and model reduction strategies."
        />
      </div>
    )
  }

  const [
    { data: realEstateRows },
    { data: assetsRows },
    { data: liabilitiesRows },
    { data: businessesRows },
    { data: trustsRows },
    { data: householdRow },
    { data: federalEstateTaxBracketsRows },
    { data: stateEstateTaxRows },
    { data: stateInheritanceTaxRows },
  ] = await Promise.all([
    supabase
      .from('real_estate')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('assets')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('liabilities')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('businesses')
      .select('id, estimated_value, ownership_pct')
      .eq('owner_id', user.id),
    supabase
      .from('trusts')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('households').select('*').eq('owner_id', user.id).maybeSingle(),
    // Fetch all years — client filters to most recent
    supabase
      .from('federal_estate_tax_brackets')
      .select('*')
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true }),
    // Fetch all years — client filters to most recent
    supabase
      .from('state_estate_tax_rules')
      .select('*')
      .order('tax_year', { ascending: false })
      .order('state', { ascending: true })
      .order('min_amount', { ascending: true }),
    // Fetch all years — client filters to most recent
    supabase
      .from('state_inheritance_tax_rules')
      .select('*')
      .order('tax_year', { ascending: false })
      .order('state', { ascending: true }),
  ])

  const netWorth = (() => {
    const assets = (assetsRows ?? []).reduce((s, a) => s + Number((a as Record<string, unknown>).value ?? 0), 0)
    const re = (realEstateRows ?? []).reduce((s, r) => s + Number((r as Record<string, unknown>).current_value ?? 0), 0)
    const liabilities = (liabilitiesRows ?? []).reduce((s, l) => s + Number((l as Record<string, unknown>).balance ?? 0), 0)
    const businesses = (businessesRows ?? []).reduce((s, b) => {
      const val = Number((b as Record<string, unknown>).estimated_value ?? 0)
      const pct = Number((b as Record<string, unknown>).ownership_pct ?? 100) / 100
      return s + val * pct
    }, 0)
    return assets + re + businesses - liabilities
  })()

  const primaryResidenceValue = (() => {
    const rows = (realEstateRows ?? []).filter(
      (r) => (r as { is_primary_residence?: boolean }).is_primary_residence === true,
    )
    if (rows.length === 0) return null as number | null
    const sum = rows.reduce(
      (s, r) => s + Number((r as { current_value?: unknown }).current_value ?? 0),
      0,
    )
    return sum > 0 ? sum : null
  })()

  const giftingSummary =
    householdRow?.id != null
      ? await supabase.rpc('calculate_gifting_summary', {
          p_household_id: householdRow.id,
        })
      : { data: null }

  const currentTaxYear = new Date().getFullYear()
  const giftingData = giftingSummary.data as
    | {
        annual_capacity?: number
        annual_used?: number
        annual_remaining?: number
        tax_year?: number
      }
    | null
  const giftingTaxYear = giftingData?.tax_year ?? currentTaxYear

  const giftRowsResult =
    householdRow?.id != null
      ? await supabase
          .from('gift_history')
          .select('recipient_name, amount, gift_type, form_709_filed')
          .eq('household_id', householdRow.id)
          .eq('tax_year', giftingTaxYear)
      : { data: null }

  const giftRows = (giftRowsResult.data ?? []) as Array<{
    recipient_name: string | null
    amount: number | null
    gift_type: string | null
    form_709_filed: boolean | null
  }>
  const splitSelected = giftRows.some((r) => r.form_709_filed === true)
  const perRecipientLimit = splitSelected ? 38000 : 19000

  const recipientGiftTotals = new Map<string, number>()
  for (const row of giftRows) {
    if ((row.gift_type ?? 'annual') !== 'annual') continue
    const recipientKey = (row.recipient_name ?? 'Unnamed recipient').trim().toLowerCase()
    const amount = Number(row.amount ?? 0)
    recipientGiftTotals.set(recipientKey, (recipientGiftTotals.get(recipientKey) ?? 0) + amount)
  }

  let qualifyingAnnualGifts = 0
  let excessAnnualGifts = 0
  let annualLoggedTotal = 0
  for (const row of giftRows) {
    if ((row.gift_type ?? 'annual') !== 'annual') continue
    annualLoggedTotal += Number(row.amount ?? 0)
  }
  recipientGiftTotals.forEach((total) => {
    const qualifying = Math.min(Math.max(0, total), perRecipientLimit)
    qualifyingAnnualGifts += qualifying
    excessAnnualGifts += Math.max(0, total - perRecipientLimit)
  })

  return (
    <>
      {householdRow?.id && (
        <EstatePlanningDashboard
          householdId={householdRow.id as string}
          userRole={access.isAdvisor ? 'advisor' : 'consumer'}
          consumerTier={access.tier}
        />
      )}
      <EstateTaxClient
        realEstate={realEstateRows ?? []}
        assets={assetsRows ?? []}
        liabilities={liabilitiesRows ?? []}
        trusts={(trustsRows ?? []) as EstateTaxTrustRow[]}
        household={householdRow as Record<string, unknown> | null}
        brackets={federalEstateTaxBracketsRows ?? []}
        stateEstateTaxRules={stateEstateTaxRows ?? []}
        stateInheritanceTaxRules={stateInheritanceTaxRows ?? []}
        primaryResidenceValue={primaryResidenceValue}
        liveNetWorth={netWorth}
        giftingAnnualCapacity={giftingData?.annual_capacity ?? null}
        giftingAnnualUsed={qualifyingAnnualGifts}
        giftingAnnualRemaining={giftingData?.annual_remaining ?? null}
        giftingAnnualLoggedTotal={annualLoggedTotal}
        giftingTaxYear={giftingTaxYear}
        giftingSplitSelected={splitSelected}
        giftingPerRecipientLimit={perRecipientLimit}
        giftingExcessOverLimit={excessAnnualGifts}
      />
    </>
  )
}
