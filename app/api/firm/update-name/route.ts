import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'

const MAX_LEN = 80

export async function POST(request: Request) {
  try {
    const ctx = await getAccessContext()
    if (!ctx.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ctx.isAdvisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!ctx.isFirmOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!ctx.firm_id) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const raw = body.name
    const trimmedName =
      typeof raw === 'string' ? raw.trim() : ''

    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Firm name cannot be empty.' },
        { status: 400 },
      )
    }
    if (trimmedName.length > MAX_LEN) {
      return NextResponse.json(
        { error: 'Firm name must be 80 characters or fewer.' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('firms')
      .update({ name: trimmedName })
      .eq('id', ctx.firm_id)
      .select('id')

    if (error) {
      console.error('firm update-name:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, name: trimmedName })
  } catch (err) {
    console.error('POST /api/firm/update-name', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
