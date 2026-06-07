import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { hasPaidDownloadAccess } from '@/lib/access/requirePaidDownloadAccess'
import { parseHouseholdIdParam } from '@/lib/api/schemas/householdAccess'
import { requireVaultHouseholdAccess } from '@/lib/api/requireVaultAccess'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ household_id: string }> }
) {
  const supabase = await createClient()

  // ── 1. Auth check ──────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { household_id } = await params
  const parsed = parseHouseholdIdParam(household_id)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier, subscription_status')
    .eq('id', user.id)
    .single()

  const callerRole = profile?.role

  const vaultAccess = await requireVaultHouseholdAccess(
    supabase,
    user.id,
    parsed.householdId,
    callerRole,
  )
  if (!vaultAccess.ok) return vaultAccess.response

  const { searchParams } = new URL(_req.url)
  const includeHistory = searchParams.get('history') === 'true'

  // ── 4. Build query ─────────────────────────────────────────
  // RLS policies enforce access — no need to manually filter by user here.
  // We always exclude soft-deleted docs.
  let query = supabase
    .from('legal_documents')
    .select(`
      id,
      household_id,
      attorney_id,
      uploaded_by,
      uploader_role,
      document_type,
      file_name,
      version,
      is_current,
      created_at
    `)
    .eq('household_id', parsed.householdId)
    .eq('is_deleted', false)
    .order('document_type', { ascending: true })
    .order('version', { ascending: false })

  // Default — only show current versions unless history requested
  if (!includeHistory) {
    query = query.eq('is_current', true)
  }

  const { data: documents, error: docsError } = await query

  if (docsError) {
    console.error('documents list error:', docsError)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }

  // ── 5. Advisors — filter by pdf access permission ──────────
  // Advisors see metadata always, but we flag which docs they
  // can download based on advisor_pdf_access on attorney_clients.
  let advisorPdfAccess = false

  if (callerRole === 'advisor') {
    const { data: clientRow } = await supabase
      .from('advisor_clients')
      .select('advisor_pdf_access')
      .eq('household_id', parsed.householdId)
      .maybeSingle()

    advisorPdfAccess = clientRow?.advisor_pdf_access ?? false
  }

  // ── 6. Shape the response ──────────────────────────────────
  // For advisors — include metadata but flag download permission.
  // For consumers and attorneys — full access.
  type DocumentRow = {
    id: string
    document_type: string
    file_name: string
    version: number
    is_current: boolean
    uploader_role: string
    created_at: string
  }

  const consumerCanDownload = hasPaidDownloadAccess(
    {
      role: profile?.role ?? null,
      consumer_tier: profile?.consumer_tier ?? null,
      subscription_status: profile?.subscription_status ?? null,
    },
    1,
  )

  const shaped = ((documents ?? []) as DocumentRow[]).map((doc: DocumentRow) => {
    const base = {
      id: doc.id,
      document_type: doc.document_type,
      file_name: doc.file_name,
      version: doc.version,
      is_current: doc.is_current,
      uploader_role: doc.uploader_role,
      uploaded_at: doc.created_at,
    }

    if (callerRole === 'advisor') {
      return {
        ...base,
        can_download: advisorPdfAccess,
      }
    }

    return {
      ...base,
      can_download: callerRole === 'consumer' ? consumerCanDownload : true,
    }
  })

  // ── 7. Return documents ────────────────────────────────────
  return NextResponse.json({
    success: true,
    household_id: parsed.householdId,
    document_count: shaped.length,
    documents: shaped,
  })
}
