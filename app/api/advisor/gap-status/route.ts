import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('advisor_gap_statuses')
    .select('gap_key, status, note, updated_at')
    .eq('advisor_id', user.id)
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ statuses: data ?? [] })
}

export async function PATCH(req: Request) {
  let body: { clientId?: string; gapKey?: string; status?: string; note?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clientId, gapKey, status, note } = body
  if (!clientId || !gapKey || !status) {
    return NextResponse.json({ error: 'clientId, gapKey, status required' }, { status: 400 })
  }

  const allowed = ['open', 'discussed', 'deferred', 'resolved']
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('advisor_gap_statuses').upsert(
    {
      advisor_id: user.id,
      client_id: clientId,
      gap_key: gapKey,
      status,
      note: note ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'advisor_id,client_id,gap_key' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
