import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'

const PRIVACY_STATUSES = new Set(['pending', 'in_progress', 'completed', 'denied'])

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') ?? 'schedule'

  if (view === 'lookup') {
    const email = searchParams.get('email')?.trim()
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, full_name, role')
      .ilike('email', email)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (profile) {
      return NextResponse.json({
        data: {
          userId: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          role: profile.role,
          hasProfile: true,
        },
      })
    }

    let page = 1
    while (true) {
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 })
      }

      const authUser = authData.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      )
      if (authUser) {
        return NextResponse.json({
          data: {
            userId: authUser.id,
            email: authUser.email ?? email,
            fullName: null,
            role: null,
            hasProfile: false,
          },
        })
      }

      if (authData.users.length < 1000) break
      page++
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (view === 'privacy') {
    const { data, error } = await admin
      .from('privacy_requests')
      .select('*')
      .order('due_at', { ascending: true })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  }

  if (view === 'audit') {
    const { data, error } = await admin
      .from('deletion_audit_log')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  }

  const { data, error } = await admin
    .from('deletion_schedule')
    .select('*')
    .order('scheduled_for', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const status = typeof body.status === 'string' ? body.status : ''
  const notes = typeof body.notes === 'string' ? body.notes : undefined

  if (!id || !PRIVACY_STATUSES.has(status)) {
    return NextResponse.json(
      { error: 'id and valid status are required' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const update: {
    status: string
    notes?: string
    completed_at?: string | null
  } = { status }

  if (notes !== undefined) {
    update.notes = notes.slice(0, 5000)
  }

  if (status === 'completed' || status === 'denied') {
    update.completed_at = new Date().toISOString()
  } else {
    update.completed_at = null
  }

  const { data, error } = await admin
    .from('privacy_requests')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
