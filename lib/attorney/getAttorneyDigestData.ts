import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getMissingDocumentAlerts,
  type DocumentGapAlert,
} from '@/lib/attorney/getMissingDocumentAlerts'
import {
  ATTORNEY_MATTER_STAGES,
  type AttorneyMatterStage,
} from '@/lib/attorney/matterWorkflow'
import { ACTIVE_ATTORNEY_CLIENT_STATUSES } from '@/lib/attorney/attorneyClientCap'

/** Matter stages unchanged longer than this are flagged in the weekly digest. */
export const STALE_MATTER_DAYS = 30

export type AttorneyDigestClientRow = {
  householdId: string
  clientName: string
  matterStage: AttorneyMatterStage
  matterStageLabel: string
  clientStatus: string
  documentGaps: DocumentGapAlert[]
  pendingDocRequests: { document_type: string; message: string | null }[]
  isStaleMatter: boolean
}

export type AttorneyDigestData = {
  attorneyName: string
  clients: AttorneyDigestClientRow[]
  summary: {
    totalClients: number
    clientsWithGaps: number
    pendingRequestCount: number
    staleMatterCount: number
  }
}

function matterStageLabel(stage: string): string {
  return (
    ATTORNEY_MATTER_STAGES.find((s) => s.value === stage)?.label ??
    stage.replace(/_/g, ' ')
  )
}

function isStaleMatter(matterStage: string, grantedAt: string | null, now: Date): boolean {
  if (matterStage === 'complete') return false
  if (!grantedAt) return false
  const granted = new Date(grantedAt)
  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() - STALE_MATTER_DAYS)
  return granted <= threshold
}

export async function getAttorneyDigestData(
  admin: SupabaseClient,
  attorneyUserId: string,
  now: Date = new Date(),
): Promise<AttorneyDigestData | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, role, is_attorney')
    .eq('id', attorneyUserId)
    .maybeSingle()

  if (!profile) return null
  const isAttorney = profile.role === 'attorney' || profile.is_attorney === true
  if (!isAttorney) return null

  const { data: listing } = await admin
    .from('attorney_listings')
    .select('id')
    .eq('profile_id', attorneyUserId)
    .maybeSingle()

  if (!listing?.id) return null

  const { data: connections } = await admin
    .from('attorney_clients')
    .select('id, client_id, matter_stage, client_status, granted_at')
    .eq('attorney_id', listing.id)
    .in('status', [...ACTIVE_ATTORNEY_CLIENT_STATUSES])

  const activeClients = connections ?? []
  if (activeClients.length === 0) return null

  const householdIds = activeClients.map((c) => c.client_id).filter(Boolean) as string[]

  const [
    { data: households },
    { data: documents },
    { data: dismissals },
    { data: docRequests },
  ] = await Promise.all([
    admin
      .from('households')
      .select('id, name, person1_first_name, person1_last_name, owner_id')
      .in('id', householdIds),
    admin
      .from('legal_documents')
      .select('household_id, document_type, is_current, is_deleted')
      .in('household_id', householdIds)
      .eq('is_deleted', false),
    admin
      .from('document_gap_dismissals')
      .select('household_id, gap_key')
      .in('household_id', householdIds)
      .eq('attorney_id', attorneyUserId),
    admin
      .from('attorney_document_requests')
      .select('household_id, document_type, message')
      .eq('attorney_listing_id', listing.id)
      .eq('status', 'pending')
      .in('household_id', householdIds),
  ])

  const ownerIds = (households ?? []).map((h) => h.owner_id).filter(Boolean) as string[]
  const { data: ownerProfiles } =
    ownerIds.length > 0
      ? await admin.from('profiles').select('id, full_name').in('id', ownerIds)
      : { data: [] as { id: string; full_name: string | null }[] }

  const dismissalsByHousehold = new Map<string, { gap_key: string }[]>()
  for (const row of dismissals ?? []) {
    const list = dismissalsByHousehold.get(row.household_id) ?? []
    list.push({ gap_key: row.gap_key })
    dismissalsByHousehold.set(row.household_id, list)
  }

  const requestsByHousehold = new Map<
    string,
    { document_type: string; message: string | null }[]
  >()
  for (const row of docRequests ?? []) {
    const list = requestsByHousehold.get(row.household_id) ?? []
    list.push({
      document_type: row.document_type,
      message: row.message ?? null,
    })
    requestsByHousehold.set(row.household_id, list)
  }

  const clients: AttorneyDigestClientRow[] = activeClients.map((connection) => {
    const householdId = connection.client_id as string
    const household = (households ?? []).find((h) => h.id === householdId)
    const owner = (ownerProfiles ?? []).find((p) => p.id === household?.owner_id)
    const householdDocs = (documents ?? []).filter((d) => d.household_id === householdId)
    const householdDismissals = dismissalsByHousehold.get(householdId) ?? []
    const documentGaps = getMissingDocumentAlerts(householdDocs, householdDismissals)
    const pendingDocRequests = requestsByHousehold.get(householdId) ?? []
    const matterStage = (connection.matter_stage ?? 'intake') as AttorneyMatterStage

    const clientName =
      owner?.full_name?.trim() ||
      [household?.person1_first_name, household?.person1_last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      household?.name?.trim() ||
      'Client'

    return {
      householdId,
      clientName,
      matterStage,
      matterStageLabel: matterStageLabel(matterStage),
      clientStatus: connection.client_status ?? 'active',
      documentGaps,
      pendingDocRequests,
      isStaleMatter: isStaleMatter(matterStage, connection.granted_at, now),
    }
  })

  const clientsWithGaps = clients.filter((c) => c.documentGaps.length > 0).length
  const pendingRequestCount = clients.reduce(
    (sum, c) => sum + c.pendingDocRequests.length,
    0,
  )
  const staleMatterCount = clients.filter((c) => c.isStaleMatter).length

  return {
    attorneyName: profile.full_name?.trim() || 'Attorney',
    clients,
    summary: {
      totalClients: clients.length,
      clientsWithGaps,
      pendingRequestCount,
      staleMatterCount,
    },
  }
}

export function attorneyDigestHasActionableItems(data: AttorneyDigestData): boolean {
  return (
    data.summary.clientsWithGaps > 0 ||
    data.summary.pendingRequestCount > 0 ||
    data.summary.staleMatterCount > 0
  )
}
