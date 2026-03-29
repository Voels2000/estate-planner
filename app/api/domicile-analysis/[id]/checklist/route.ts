import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

async function assertAccessToUser(
  supabase: SupabaseClient,
  sessionUserId: string,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (targetUserId === sessionUserId) {
    return { ok: true }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', sessionUserId)
    .single()

  if (profile?.role !== 'advisor') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', sessionUserId)
    .eq('client_id', targetUserId)
    .maybeSingle()

  if (!link) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true }
}

async function requireAnalysisAccess(
  supabase: SupabaseClient,
  sessionUserId: string,
  analysisId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: analysis, error } = await supabase
    .from('domicile_analysis')
    .select('user_id')
    .eq('id', analysisId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Analysis not found' }, { status: 404 }),
      }
    }
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    }
  }

  if (!analysis) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Analysis not found' }, { status: 404 }),
    }
  }

  const access = await assertAccessToUser(supabase, sessionUserId, analysis.user_id)
  if (!access.ok) return access

  return { ok: true }
}

export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: analysisId } = await params

  const gate = await requireAnalysisAccess(supabase, user.id, analysisId)
  if (!gate.ok) return gate.response

  const body = await request.json()
  const { item_id, completed } = body

  if (!item_id || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'item_id and completed are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('domicile_checklist_items')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', item_id)
    .eq('analysis_id', analysisId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

export async function GET(_request: Request, { params }: Params) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: analysisId } = await params

  const gate = await requireAnalysisAccess(supabase, user.id, analysisId)
  if (!gate.ok) return gate.response

  const { data, error } = await supabase
    .from('domicile_checklist_items')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('priority', { ascending: false })
    .order('category', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data })
}
