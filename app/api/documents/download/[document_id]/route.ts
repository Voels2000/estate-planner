import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { document_id: string } }
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

  const { document_id } = params

  // ── 2. Fetch document record ────────────────────────────────
  // RLS on legal_documents ensures caller can only fetch docs
  // they are authorized to see — no manual filter needed.
  const { data: document, error: docError } = await supabase
    .from('legal_documents')
    .select('id, household_id, storage_path, file_name, is_deleted')
    .eq('id', document_id)
    .single()

  if (docError || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (document.is_deleted) {
    return NextResponse.json({ error: 'Document has been deleted' }, { status: 410 })
  }

  // ── 3. Get caller role ─────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const callerRole = profile?.role

  // ── 4. Advisor download permission check ───────────────────
  // Consumers and attorneys can always download (RLS already confirmed access).
  // Advisors need explicit consumer grant via advisor_pdf_access.
  if (callerRole === 'advisor') {
    const { data: clientRow } = await supabase
      .from('advisor_clients')
      .select('advisor_pdf_access')
      .eq('household_id', document.household_id)
      .maybeSingle()

    if (!clientRow?.advisor_pdf_access) {
      return NextResponse.json(
        { error: 'You do not have permission to download documents for this client' },
        { status: 403 }
      )
    }
  }

  // ── 5. Generate signed URL — expires in 60 seconds ─────────
  // Short expiry forces every download through this route,
  // ensuring the audit log is always written.
  const { data: signedUrl, error: urlError } = await supabase.storage
    .from('legal-documents')
    .createSignedUrl(document.storage_path, 60)

  if (urlError || !signedUrl) {
    console.error('signed url error:', urlError)
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
  }

  // ── 6. Write immutable download log entry ──────────────────
  // Non-fatal — log error but do not block the download.
  try {
    await supabase.from('document_download_log').insert({
      document_id,
      downloaded_by: user.id,
      downloader_role: callerRole,
    })
  } catch (logError) {
    console.error('download log write error:', logError)
  }

  // ── 7. Return signed URL ───────────────────────────────────
  return NextResponse.json({
    success: true,
    url: signedUrl.signedUrl,
    file_name: document.file_name,
    expires_in: 60,
  })
}
