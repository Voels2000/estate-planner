import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EstateTaxClient, { type EstateTaxTrustRow } from '@/app/(dashboard)/estate-tax/_estate-tax-client'
import EstatePlanningDashboard from '@/components/EstatePlanningDashboard'
import { AttorneyClientVault } from '../../_attorney-client-vault'

export default async function AttorneyClientPage({
  params,
}: {
  params: Promise<{ household_id: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_attorney')
    .eq('id', user.id)
    .single()

  const isAttorney = profile?.role === 'attorney' || profile?.is_attorney === true
  if (!isAttorney) redirect('/dashboard')

  const { household_id } = await params

  const { data: connection } = await supabase
    .from('attorney_clients')
    .select('id, granted_at')
    .eq('attorney_id', user.id)
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
    .select('id, document_type, file_name, version, is_current, uploader_role, created_at')
    .eq('household_id', household_id)
    .eq('is_current', true)
    .eq('is_deleted', false)
    .order('document_type', { ascending: true })

  const { data: clientProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', ownerId)
    .single()

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
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
          👁 Read-only view
        </span>
      </div>

      {household?.id && (
        <EstatePlanningDashboard
          householdId={household.id}
          userRole="advisor"
          consumerTier={3}
        />
      )}

      <div className="pointer-events-none opacity-95 select-none">
        <p className="text-xs text-amber-600 mb-2 pointer-events-none">
          ⚠️ This is a read-only view. Changes cannot be made from the attorney portal.
        </p>
        <EstateTaxClient
          realEstate={realEstateRows ?? []}
          assets={assetsRows ?? []}
          liabilities={liabilitiesRows ?? []}
          trusts={(trustsRows ?? []) as EstateTaxTrustRow[]}
          household={household as Record<string, unknown> | null}
          brackets={federalEstateTaxBracketsRows ?? []}
          stateEstateTaxRules={stateEstateTaxRows ?? []}
          stateInheritanceTaxRules={stateInheritanceTaxRows ?? []}
          primaryResidenceValue={primaryResidenceValue}
        />
      </div>

      <AttorneyClientVault
        householdId={household_id}
        attorneyId={user.id}
        documents={documents ?? []}
      />
    </div>
  )
}
