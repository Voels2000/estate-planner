import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // ── 1. Auth + admin check ──────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.is_admin !== true) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 2. Parse body ──────────────────────────────────────────
  const { version, sections } = await req.json()

  if (!version || !sections || !Array.isArray(sections)) {
    return NextResponse.json(
      { error: 'version and sections array are required' },
      { status: 400 }
    )
  }

  if (sections.some((s: unknown) =>
    typeof s !== 'object' ||
    s === null ||
    !('title' in s) ||
    !('body' in s)
  )) {
    return NextResponse.json(
      { error: 'Each section must have a title and body' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  // ── 3. Update version ──────────────────────────────────────
  const { error: versionError } = await supabase
    .from('app_config')
    .update({ value: version, updated_at: now })
    .eq('key', 'terms_version')

  if (versionError) {
    console.error('terms version update error:', versionError)
    return NextResponse.json({ error: 'Failed to update version' }, { status: 500 })
  }

  // ── 4. Update sections ─────────────────────────────────────
  const { error: sectionsError } = await supabase
    .from('app_config')
    .update({ value: JSON.stringify(sections), updated_at: now })
    .eq('key', 'terms_sections')

  if (sectionsError) {
    console.error('terms sections update error:', sectionsError)
    return NextResponse.json({ error: 'Failed to update sections' }, { status: 500 })
  }

  // ── 5. Re-gate all users who accepted the old version ──────
  // Sets terms_accepted_at to null for any user whose
  // terms_version does not match the new version,
  // forcing them to re-accept on next login.
  const { error: regateError } = await supabase
    .from('profiles')
    .update({ terms_accepted_at: null, terms_version: null })
    .neq('terms_version', version)
    .not('terms_accepted_at', 'is', null)

  if (regateError) {
    // Non-fatal — log but don't block
    console.error('terms regate error:', regateError)
  }

  return NextResponse.json({
    success:          true,
    version,
    sections_count:   sections.length,
    users_re_gated:   !regateError,
  })
}
