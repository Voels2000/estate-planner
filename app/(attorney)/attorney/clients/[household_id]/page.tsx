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
import { getMissingDocumentAlerts } from '@/lib/attorney/getMissingDocumentAlerts'
import { attorneyTierFeatures } from '@/lib/attorney/attorneyTierLimits'

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

  const [
    { data: realEstateRows },
    { data: assetsRows },
    { data: liabilitiesRows },
    { data: trustsRows },
    { data: federalEstateTaxBracketsRows },
    { data: stateEstateTaxRows },
    { data: stateInheritanceTaxRows },
  ] = await Promise.all([
    supabase.from('real_estate').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase.from('assets').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase.from('liabilities').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase.from('trusts').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase.from('federal_estate_tax_brackets').select('*').order('tax_year', { ascending: false }).order('min_amount', { ascending: true }),
    supabase.from('state_estate_tax_rules').select('*').order('tax_year', { ascending: false }).order('state', { ascending: true }).order('min_amount', { ascending: true }),
    supabase.from('state_inheritance_tax_rules').select('*').order('tax_year', { ascending: false }).order('state', { ascending: true }),
  ])

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

  const { data: documents } = await supabase
    .from('legal_documents')
    .select(
      'id, document_type, file_name, version, is_current, uploader_role, created_at, doc_status, executed_date, status_notes',
    )
    .eq('household_id', household_id)
    .eq('is_current', true)
    .eq('is_deleted', false)
    .order('document_type', { ascending: true })

  const { data: gapDismissals } = await supabase
    .from('document_gap_dismissals')
    .select('gap_key')
    .eq('household_id', household_id)
    .eq('attorney_id', user.id)

  const { data: attorneyProfile } = await supabase
    .from('profiles')
    .select('attorney_tier')
    .eq('id', user.id)
    .single()

  const tierFeatures = attorneyTierFeatures(attorneyProfile?.attorney_tier ?? 0)
  const documentGaps = getMissingDocumentAlerts(documents ?? [], gapDismissals ?? [])

  const { data: clientProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', ownerId)
    .single()

  const estatePlanningDashboard = await loadEstatePlanningDashboard(supabase, household_id)

  const { data: notes } = await supabase
    .from('attorney_notes')
    .select('id, content, note_type, created_at')
    .eq('attorney_listing_id', attorneyListing.id)
    .eq('household_id', household_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: docRequests } = await supabase
    .from('attorney_document_requests')
    .select('id, document_type, message, status, requested_at')
    .eq('attorney_listing_id', attorneyListing.id)
    .eq('household_id', household_id)
    .order('requested_at', { ascending: false })
    .limit(20)

  const matterStage = (connection.matter_stage ?? 'intake') as AttorneyMatterStage
  const clientStatus = (connection.client_status ?? 'active') as AttorneyClientStatus

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <a href="/attorney" className="text-sm text-neutral-400 hover:text-neutral-600 mb-1 block">
            ← Back to clients
          </a>
          <h1 className="text-2xl font-semibold text-neutral-900">
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
        <EstatePlanningDashboard
          householdId={household.id}
          userRole="advisor"
          consumerTier={3}
          initialRecommendations={estatePlanningDashboard.recommendations}
          initialCompleteness={estatePlanningDashboard.completeness}
        />
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
