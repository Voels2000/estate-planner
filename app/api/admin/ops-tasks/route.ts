import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import {
  advanceOpsTaskDueDate,
  computeOpsTaskUrgency,
  type OpsTaskCadence,
  type OpsTaskRow,
} from '@/lib/admin/opsTasks'

const VALID_CADENCES = new Set([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annual',
  'once',
])

const VALID_CATEGORIES = new Set([
  'compliance',
  'legal',
  'security',
  'ops',
  'billing',
])

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `${base}-${Date.now().toString(36)}`
}

export async function GET() {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ops_tasks')
    .select('*')
    .order('next_due_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tasks = (data ?? []).map((row) => ({
    ...(row as OpsTaskRow),
    urgency: computeOpsTaskUrgency(row as OpsTaskRow),
  }))

  return NextResponse.json({ tasks })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const notes =
    typeof body.notes === 'string' && body.notes.trim()
      ? body.notes.trim().slice(0, 2000)
      : null
  const method =
    typeof body.method === 'string' && body.method.trim()
      ? body.method.trim()
      : `admin:${auth.userId}`

  const admin = createAdminClient()
  const { data: existing, error: fetchError } = await admin
    .from('ops_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const cadence = existing.cadence as OpsTaskCadence
  const now = new Date()
  const nextDue = advanceOpsTaskDueDate(cadence, now)
  const isOnce = cadence === 'once'

  const { data: updated, error } = await admin
    .from('ops_tasks')
    .update({
      last_completed_at: now.toISOString(),
      last_completed_by: method,
      completion_method: method,
      completion_notes: notes,
      status: isOnce ? 'completed' : 'pending',
      next_due_at: isOnce ? existing.next_due_at : (nextDue ?? existing.next_due_at),
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    task: {
      ...(updated as OpsTaskRow),
      urgency: computeOpsTaskUrgency(updated as OpsTaskRow),
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const description =
    typeof body.description === 'string' ? body.description.trim() : null
  const category =
    typeof body.category === 'string' && VALID_CATEGORIES.has(body.category)
      ? body.category
      : 'ops'

  let nextDue: Date
  if (typeof body.due_at === 'string') {
    nextDue = new Date(body.due_at)
    if (Number.isNaN(nextDue.getTime())) {
      return NextResponse.json({ error: 'Invalid due_at' }, { status: 400 })
    }
  } else {
    nextDue = new Date()
    nextDue.setDate(nextDue.getDate() + 7)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ops_tasks')
    .insert({
      slug: slugify(title),
      title,
      description,
      cadence: 'once' as OpsTaskCadence,
      next_due_at: nextDue.toISOString(),
      category,
      status: 'pending',
      auto_complete: false,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      task: {
        ...(data as OpsTaskRow),
        urgency: computeOpsTaskUrgency(data as OpsTaskRow),
      },
    },
    { status: 201 },
  )
}
