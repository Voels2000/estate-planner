import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('education_progress')
    .select('module_slug, completed, updated_at')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const completedSlugs = (data ?? [])
    .filter((row) => row.completed === true)
    .map((row) => row.module_slug)

  const completedEntries = (data ?? [])
    .filter((row) => row.completed === true)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((row) => ({
      moduleSlug: row.module_slug,
      updatedAt: row.updated_at,
    }))

  return NextResponse.json({ completedSlugs, completedEntries })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { moduleSlug?: string; completed?: boolean }
    | null
  const moduleSlug = body?.moduleSlug
  const completed = body?.completed

  if (!moduleSlug || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'moduleSlug and completed are required' }, { status: 400 })
  }

  const payload = {
    user_id: user.id,
    module_slug: moduleSlug,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  }

  const { error } = await supabase
    .from('education_progress')
    .upsert(payload, { onConflict: 'user_id,module_slug' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

