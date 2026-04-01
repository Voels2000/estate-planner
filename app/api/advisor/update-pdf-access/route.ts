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
  const { advisor_client_id, pdf_access } = await req.json()
  if (!advisor_client_id || typeof pdf_access !== 'boolean') {
    return NextResponse.json(
      { error: 'advisor_client_id and pdf_access (boolean) are required' },
      { status: 400 }
    )
  }

  // ── 3. Confirm caller is the consumer on this advisor row ──
  const { data: advisorRow } = await supabase
    .from('advisor_clients')
    .select('id, client_id')
    .eq('id', advisor_client_id)
    .single()

  if (!advisorRow || advisorRow.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 4. Update pdf access flag ──────────────────────────────
  const { error: updateError } = await supabase
    .from('advisor_clients')
    .update({ advisor_pdf_access: pdf_access })
    .eq('id', advisor_client_id)

  if (updateError) {
    console.error('advisor update-pdf-access error:', updateError)
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 })
  }

  return NextResponse.json({ success: true, pdf_access })
}
