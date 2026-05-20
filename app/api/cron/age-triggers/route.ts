import { createAdminClient } from '@/lib/supabase/admin'
import { isValidLifeEventType } from '@/lib/events/lifeEventSlugs'
import { NextResponse } from 'next/server'

/** Age milestones → life event slug (see Sprint 3 spec). */
const AGE_MILESTONES: { age: number; event_type: string }[] = [
  { age: 62, event_type: 'approaching-retirement' },
  { age: 65, event_type: 'approaching-retirement' },
  { age: 70, event_type: 'approaching-retirement' },
  { age: 73, event_type: 'approaching-retirement' },
]

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const currentYear = new Date().getFullYear()
  const results = { inserted: 0, skipped: 0, errors: 0 }

  const { data: households, error: hhError } = await supabase
    .from('households')
    .select('owner_id, person1_birth_year, person2_birth_year, has_spouse')

  if (hhError) {
    console.error('[cron:age-triggers] households', hhError.message)
    return NextResponse.json({ error: hhError.message }, { status: 500 })
  }

  const yearStart = `${currentYear}-01-01T00:00:00.000Z`

  for (const hh of households ?? []) {
    const birthYears = [hh.person1_birth_year]
    if (hh.has_spouse && hh.person2_birth_year) {
      birthYears.push(hh.person2_birth_year)
    }

    for (const birthYear of birthYears) {
      if (!birthYear || typeof birthYear !== 'number') continue
      const age = currentYear - birthYear
      const milestone = AGE_MILESTONES.find(m => m.age === age)
      if (!milestone || !isValidLifeEventType(milestone.event_type)) continue

      const userId = hh.owner_id as string

      const { data: existing } = await supabase
        .from('life_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', milestone.event_type)
        .eq('source', 'calendar_trigger')
        .gte('created_at', yearStart)
        .limit(1)

      if (existing && existing.length > 0) {
        results.skipped++
        continue
      }

      const { error: insertError } = await supabase.from('life_events').insert({
        user_id: userId,
        event_type: milestone.event_type,
        source: 'calendar_trigger',
        acknowledged: false,
        event_date: `${currentYear}-01-01`,
      })

      if (insertError) {
        console.error('[cron:age-triggers] insert', userId, insertError.message)
        results.errors++
      } else {
        results.inserted++
      }
    }
  }

  console.log('[cron:age-triggers]', results)
  return NextResponse.json({ ok: true, ...results })
}
