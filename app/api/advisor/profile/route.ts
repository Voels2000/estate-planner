import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { createClient } from '@/lib/supabase/server'

const PROFILE_SELECT = 'full_name, email, firm_name, phone, firm_logo_url'

type ProfileRow = {
  full_name: string | null
  email: string | null
  firm_name: string | null
  phone: string | null
  firm_logo_url: string | null
}

function trimOrNull(value: unknown, maxLen: number): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length > maxLen) return undefined
  return trimmed.length > 0 ? trimmed : null
}

export async function GET() {
  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', ctx.user.id)
    .maybeSingle()

  if (error) {
    console.error('[advisor/profile GET]', error)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }

  return NextResponse.json({ profile: data as ProfileRow | null })
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const updates: Record<string, string | null> = {}

  if ('full_name' in body) {
    const fullName = trimOrNull(body.full_name, 100)
    if (fullName === undefined) {
      return NextResponse.json({ error: 'full_name must be at most 100 characters' }, { status: 400 })
    }
    updates.full_name = fullName
  }

  if ('firm_name' in body) {
    const firmName = trimOrNull(body.firm_name, 100)
    if (firmName === undefined) {
      return NextResponse.json({ error: 'firm_name must be at most 100 characters' }, { status: 400 })
    }
    updates.firm_name = firmName
  }

  if ('phone' in body) {
    const phone = trimOrNull(body.phone, 30)
    if (phone === undefined) {
      return NextResponse.json({ error: 'phone must be at most 30 characters' }, { status: 400 })
    }
    updates.phone = phone
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', ctx.user.id)
    .select(PROFILE_SELECT)
    .single()

  if (error || !data) {
    console.error('[advisor/profile PATCH]', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ profile: data as ProfileRow })
}
