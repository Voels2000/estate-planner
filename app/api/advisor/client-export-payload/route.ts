import { createClient } from '@/lib/supabase/server'
import { loadAdvisorClientExportPayload } from '@/lib/advisor/loadClientExportPayload'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')?.trim()
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'advisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = await loadAdvisorClientExportPayload(supabase, user.id, clientId)
  if (!payload) {
    return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 })
  }

  return NextResponse.json(payload)
}
