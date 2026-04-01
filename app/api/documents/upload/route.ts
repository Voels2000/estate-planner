import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // ── 1. Auth check ──────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse multipart form data ───────────────────────────
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const household_id = formData.get('household_id') as string | null
  const document_type = formData.get('document_type') as string | null
  const attorney_id = formData.get('attorney_id') as string | null

  if (!file || !household_id || !document_type) {
    return NextResponse.json(
      { error: 'file, household_id, and document_type are required' },
      { status: 400 }
    )
  }

  // ── 3. Validate file is PDF ─────────────────────────────────
  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are accepted' },
      { status: 400 }
    )
  }

  // ── 4. Confirm caller is authorized for this household ──────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const callerRole = profile?.role

  if (callerRole === 'consumer') {
    // Consumer must own the household
    const { data: household } = await supabase
      .from('households')
      .select('id')
      .eq('id', household_id)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!household) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (callerRole === 'attorney') {
    // Attorney must have active connection to this household
    const { data: connection } = await supabase
      .from('attorney_clients')
      .select('id')
      .eq('attorney_id', user.id)
      .eq('client_id', household_id)
      .in('status', ['active', 'accepted'])
      .maybeSingle()

    if (!connection) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    return NextResponse.json(
      { error: 'Only consumers and attorneys can upload documents' },
      { status: 403 }
    )
  }

  // ── 5. Check for existing version of same document type ─────
  // If one exists, increment version and mark old one is_current=false
  const { data: existingDocs } = await supabase
    .from('legal_documents')
    .select('id, version')
    .eq('household_id', household_id)
    .eq('document_type', document_type)
    .eq('is_current', true)
    .eq('is_deleted', false)

  const nextVersion = existingDocs && existingDocs.length > 0
    ? Math.max(...existingDocs.map((d: { id: string; version: number }) => d.version)) + 1
    : 1

  // Mark all existing current versions as no longer current
  if (existingDocs && existingDocs.length > 0) {
    await supabase
      .from('legal_documents')
      .update({ is_current: false })
      .in('id', existingDocs.map((d: { id: string; version: number }) => d.id))
  }

  // ── 6. Build storage path and upload to Supabase Storage ────
  // Path pattern: households/{household_id}/{document_type}/v{version}_{timestamp}_{filename}
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `households/${household_id}/${document_type}/v${nextVersion}_${timestamp}_${safeName}`

  const fileBuffer = await file.arrayBuffer()

  const { error: storageError } = await supabase.storage
    .from('legal-documents')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (storageError) {
    console.error('document upload storage error:', storageError)
    // Restore previous version if upload fails
    if (existingDocs && existingDocs.length > 0) {
      await supabase
        .from('legal_documents')
        .update({ is_current: true })
        .in('id', existingDocs.map((d: { id: string; version: number }) => d.id))
    }
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
  }

  // ── 7. Write record to legal_documents ─────────────────────
  const { data: document, error: dbError } = await supabase
    .from('legal_documents')
    .insert({
      household_id,
      attorney_id: attorney_id ?? null,
      uploaded_by: user.id,
      uploader_role: callerRole,
      document_type,
      file_name: file.name,
      storage_path: storagePath,
      version: nextVersion,
      is_current: true,
      is_deleted: false,
    })
    .select()
    .single()

  if (dbError) {
    console.error('document upload db error:', dbError)
    return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 })
  }

  // ── 8. Get uploader profile for notification ────────────────
  const { data: uploaderProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // ── 9. Notify the other party (non-fatal) ──────────────────
  try {
    if (callerRole === 'attorney') {
      // Attorney uploaded — notify consumer
      const { data: consumerHousehold } = await supabase
        .from('households')
        .select('owner_id')
        .eq('id', household_id)
        .single()

      if (consumerHousehold?.owner_id) {
        await supabase.from('notifications').insert({
          user_id: consumerHousehold.owner_id,
          type: 'attorney_document_uploaded',
          title: 'New document added to your vault',
          body: `${uploaderProfile?.full_name ?? 'Your attorney'} uploaded a new ${document_type.replace(/_/g, ' ')} document to your vault.`,
          delivery: 'in_app',
          read: false,
        })
      }
    } else {
      // Consumer uploaded — notify attorney if one is linked
      if (attorney_id) {
        await supabase.from('notifications').insert({
          user_id: attorney_id,
          type: 'consumer_document_uploaded',
          title: 'Client uploaded a document',
          body: `${uploaderProfile?.full_name ?? 'Your client'} uploaded a new ${document_type.replace(/_/g, ' ')} document to their vault.`,
          delivery: 'in_app',
          read: false,
        })
      }
    }
  } catch (notifyError) {
    console.error('document upload notification error:', notifyError)
  }

  // ── 10. Return success ──────────────────────────────────────
  return NextResponse.json({
    success: true,
    document_id: document.id,
    file_name: document.file_name,
    version: document.version,
    storage_path: document.storage_path,
  })
}
