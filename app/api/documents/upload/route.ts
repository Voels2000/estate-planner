import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolveAttorneyProfileId } from '@/lib/attorney/resolveAttorneyProfileId'
import { requireVaultHouseholdAccess } from '@/lib/api/requireVaultAccess'
import { householdIdSchema } from '@/lib/api/schemas/householdAccess'

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

  const householdParsed = householdIdSchema.safeParse(household_id)
  if (!householdParsed.success) {
    return NextResponse.json({ error: 'Invalid household_id' }, { status: 400 })
  }
  const householdId = householdParsed.data

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

  const vaultAccess = await requireVaultHouseholdAccess(
    supabase,
    user.id,
    householdId,
    callerRole,
  )
  if (!vaultAccess.ok) return vaultAccess.response

  if (vaultAccess.role === 'advisor') {
    return NextResponse.json(
      { error: 'Only consumers and attorneys can upload documents' },
      { status: 403 },
    )
  }

  // ── 5. Check for existing version of same document type ─────
  // If one exists, increment version and mark old one is_current=false
  const { data: existingDocs } = await supabase
    .from('legal_documents')
    .select('id, version')
    .eq('household_id', householdId)
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
  const storagePath = `households/${householdId}/${document_type}/v${nextVersion}_${timestamp}_${safeName}`

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
      household_id: householdId,
      attorney_id: attorney_id ?? null,
      uploaded_by: user.id,
      uploader_role: vaultAccess.role === 'attorney' ? 'attorney' : 'consumer',
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
    if (vaultAccess.role === 'attorney') {
      const { data: consumerHousehold } = await supabase
        .from('households')
        .select('owner_id')
        .eq('id', householdId)
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
        const attorneyProfileId = await resolveAttorneyProfileId(supabase, attorney_id)
        if (attorneyProfileId) {
          await supabase.from('notifications').insert({
            user_id: attorneyProfileId,
            type: 'consumer_document_uploaded',
            title: 'Client uploaded a document',
            body: `${uploaderProfile?.full_name ?? 'Your client'} uploaded a new ${document_type.replace(/_/g, ' ')} document to their vault.`,
            delivery: 'in_app',
            read: false,
          })
        }
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
