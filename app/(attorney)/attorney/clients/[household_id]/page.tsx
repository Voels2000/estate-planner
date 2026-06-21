import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EstateTaxClient, { type EstateTaxTrustRow } from '@/app/(dashboard)/estate-tax/_estate-tax-client'
import EstatePlanningDashboard from '@/components/EstatePlanningDashboard'
import { AttorneyClientVault } from '../../_attorney-client-vault'
import { AttorneyClientWorkflowPanel } from '@/components/attorney/AttorneyClientWorkflowPanel'
import { AttorneyNotesPanel } from '@/components/attorney/AttorneyNotesPanel'
import { AttorneyDocumentRequestsPanel } from '@/components/attorney/AttorneyDocumentRequestsPanel'
import type { AttorneyClientStatus, AttorneyMatterStage } from '@/lib/attorney/matterWorkflow'
import { loadEstatePlanningDashboard } from '@/lib/estate/loadEstatePlanningDashboard'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { triggerEstateHealthRecompute } from '@/lib/estate/triggerEstateHealthRecompute'
import { getConsumerAppUrl } from '@/lib/consumer/afterHouseholdWrite'
import { getMissingDocumentAlerts } from '@/lib/attorney/getMissingDocumentAlerts'
import { attorneyTierFeatures } from '@/lib/attorney/attorneyTierLimits'

/** Fields read from `real_estate` rows for primary-residence value rollup. */
type RealEstatePrimaryResidenceRow = {
  is_primary_residence?: boolean | null
  current_value?: number | string | null
}

export default async function AttorneyClientPage({
  params,
}: {
  params: Promise<{ household_id: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { household_id } = await params

  const { data: attorneyListing } = await supabase
    .from('attorney_listings')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!attorneyListing) redirect('/attorney')

  const { data: connection } = await supabase
    .from('attorney_clients')
    .select('id, granted_at, matter_stage, client_status')
    .eq('attorney_id', attorneyListing.id)
    .eq('client_id', household_id)
    .in('status', ['active', 'accepted'])
    .maybeSingle()

  if (!connection) redirect('/attorney')

  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('id', household_id)
    .single()

  if (!household) redirect('/attorney')

  const ownerId = household.owner_id
  const currentYear = new Date().getFullYear()
  const stateCode = String(household.state_primary ?? '').trim().toUpperCase()

  const [
    { data: realEstateRows },
    { data: assetsRows },
    { data: liabilitiesRows },
    { data: trustsRows },
    { data: federalEstateTaxBracketsRows },
    { data: stateEstateTaxRows },
    { data: stateInheritanceTaxRows },
    giftingSummaryRes,
    estatePlanningDashboard,
    { data: documents },
    { data: gapDismissals },
    { data: attorneyProfile },
    { data: clientProfile },
    { data: notes },
    { data: docRequests },
  ] = await Promise.all([
    supabase.from('real_estate').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase.from('assets').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase.from('liabilities').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase.from('trusts').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase
      .from('federal_estate_tax_brackets')
      .select('*')
      .eq('tax_year', currentYear)
      .order('min_amount', { ascending: true }),
    stateCode
      ? supabase
          .from('state_estate_tax_rules')
          .select('*')
          .eq('state', stateCode)
          .eq('tax_year', currentYear)
          .order('min_amount', { ascending: true })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    stateCode
      ? supabase
          .from('state_inheritance_tax_rules')
          .select('*')
          .eq('state', stateCode)
          .eq('tax_year', currentYear)
          .order('beneficiary_class', { ascending: true })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase.rpc('calculate_gifting_summary', { p_household_id: household_id }),
    loadEstatePlanningDashboard(supabase, household_id, { recommendationsCacheOnly: true }),
    supabase
      .from('legal_documents')
      .select(
        'id, document_type, file_name, version, is_current, uploader_role, created_at, doc_status, executed_date, status_notes',
      )
      .eq('household_id', household_id)
      .eq('is_current', true)
      .eq('is_deleted', false)
      .order('document_type', { ascending: true }),
    supabase
      .from('document_gap_dismissals')
      .select('gap_key')
      .eq('household_id', household_id)
      .eq('attorney_id', user.id),
    supabase.from('profiles').select('attorney_tier').eq('id', user.id).single(),
    supabase.from('profiles').select('full_name, email').eq('id', ownerId).single(),
    supabase
      .from('attorney_notes')
      .select('id, content, note_type, created_at')
      .eq('attorney_listing_id', attorneyListing.id)
      .eq('household_id', household_id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('attorney_document_requests')
      .select('id, document_type, message, status, requested_at')
      .eq('attorney_listing_id', attorneyListing.id)
      .eq('household_id', household_id)
      .order('requested_at', { ascending: false })
      .limit(20),
  ])

  const lifetimeGiftsUsed = Math.max(
    0,
    Number(
      (giftingSummaryRes.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ??
        0,
    ) || 0,
  )
  const composition = await getCachedComposition(
    supabase,
    household_id,
    'consumer',
    lifetimeGiftsUsed,
  )

  if (estatePlanningDashboard.recommendationsPendingRecompute) {
    void triggerEstateHealthRecompute(household_id, getConsumerAppUrl())
  }

  const primaryResidenceValue = (() => {
    const rows = (realEstateRows as RealEstatePrimaryResidenceRow[] | null ?? []).filter(
      (r) => r.is_primary_residence === true,
    )
    if (rows.length === 0) return null as number | null
    const sum = rows.reduce(
      (s, r) => s + Number(r.current_value ?? 0),
      0,
    )
    return sum > 0 ? sum : null
  })()

  const tierFeatures = attorneyTierFeatures(attorneyProfile?.attorney_tier ?? 0)
  const documentGaps = getMissingDocumentAlerts(documents ?? [], gapDismissals ?? [])

  const matterStage = (connection.matter_stage ?? 'intake') as AttorneyMatterStage
  const clientStatus = (connection.client_status ?? 'active') as AttorneyClientStatus

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <a href="/attorney" className="text-sm text-neutral-400 hover:text-neutral-600 mb-1 block">
            ← Back to clients
          </a>
          <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">
            {clientProfile?.full_name ?? 'Client'}
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {clientProfile?.email} · Access granted{' '}
            {connection.granted_at ? new Date(connection.granted_at).toLocaleDateString() : ''}
          </p>
        </div>
        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-medium">
          👁 Client-owned data · read-only view
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttorneyClientWorkflowPanel
          householdId={household_id}
          initialMatterStage={matterStage}
          initialClientStatus={clientStatus}
        />
        <AttorneyNotesPanel householdId={household_id} initialNotes={notes ?? []} />
      </div>

      <AttorneyDocumentRequestsPanel
        householdId={household_id}
        initialRequests={docRequests ?? []}
      />

      {household?.id && (
        <>
          {estatePlanningDashboard.recommendationsPendingRecompute && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Planning recommendations are updating in the background. Refresh in a moment for the
              latest analysis.
            </p>
          )}
          <EstatePlanningDashboard
            householdId={household.id}
            userRole="advisor"
            consumerTier={3}
            initialRecommendations={estatePlanningDashboard.recommendations}
            initialCompleteness={estatePlanningDashboard.completeness}
          />
        </>
      )}

      <div className="pointer-events-none opacity-95 select-none">
        <p className="text-xs text-amber-600 mb-2 pointer-events-none">
          ⚠️ This is a read-only view. Changes cannot be made from the attorney portal.
        </p>
        <EstateTaxClient
          liabilities={liabilitiesRows ?? []}
          trusts={(trustsRows ?? []) as EstateTaxTrustRow[]}
          household={household as Record<string, unknown> | null}
          brackets={federalEstateTaxBracketsRows ?? []}
          stateEstateTaxRules={stateEstateTaxRows ?? []}
          stateInheritanceTaxRules={stateInheritanceTaxRows ?? []}
          composition={composition}
        />
      </div>

      <AttorneyClientVault
        householdId={household_id}
        attorneyId={user.id}
        documents={documents ?? []}
        documentGaps={tierFeatures.documentGapAlerts ? documentGaps : []}
        canExportIntake={tierFeatures.intakeSummaryExport}
      />
    </div>
  )
}
