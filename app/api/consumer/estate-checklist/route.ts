import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isEstateChecklistTaskKey } from '@/lib/estate/estateChecklistTaskKeys'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!household) return NextResponse.json({ items: [] })

  const { data: items, error } = await supabase
    .from('estate_checklist_items')
    .select('task_key, completed, completed_at, notes')
    .eq('household_id', household.id)
    .order('task_key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: items ?? [] })
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    task_key?: string
    completed?: boolean
    notes?: string | null
  }

  const { task_key: taskKey, completed, notes } = body

  if (!taskKey || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'task_key and completed required' }, { status: 400 })
  }

  if (!isEstateChecklistTaskKey(taskKey)) {
    return NextResponse.json({ error: 'Invalid task_key' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  const { error } = await supabase.from('estate_checklist_items').upsert(
    {
      household_id: household.id,
      task_key: taskKey,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      notes: notes ?? null,
    },
    { onConflict: 'household_id,task_key' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/dashboard')
  revalidatePath('/my-estate-trust-strategy')

  return NextResponse.json({ ok: true })
}
