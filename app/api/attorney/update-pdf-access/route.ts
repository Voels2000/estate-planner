import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // ── 1. Auth check ──────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────
  const { connection_id, pdf_access } = await req.json()
  if (!connection_id || typeof pdf_access !== 'boolean') {
    return NextResponse.json(
      { error: 'connection_id and pdf_access (boolean) are required' },
      { status: 400 }
    )
  }

  // ── 3. Confirm caller is the consumer on this connection ───
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const { data: connection } = await supabase
    .from('attorney_clients')
    .select('id, client_id')
    .eq('id', connection_id)
    .single()

  if (!connection || connection.client_id !== household?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 4. Update pdf access flag ──────────────────────────────
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('attorney_clients')
    .update({
      advisor_pdf_access: pdf_access,
      advisor_pdf_access_granted_at: pdf_access ? now : null,
      advisor_pdf_access_granted_by: pdf_access ? user.id : null,
    })
    .eq('id', connection_id)

  if (updateError) {
    console.error('update-pdf-access error:', updateError)
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 })
  }

  return NextResponse.json({ success: true, pdf_access })
}
