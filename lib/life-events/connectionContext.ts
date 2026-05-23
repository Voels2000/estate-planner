import type { SupabaseClient } from '@supabase/supabase-js'
import { formatLifeEventLabel } from '@/lib/life-events/eventLabels'

export type ConnectionLifeEventSnapshot = {
  event_type: string
  event_label: string
  event_date: string | null
  source: string
  recorded_at: string
}

function snapshotFromSlug(
  eventSlug: string,
  recordedAt: string,
  source: string,
): ConnectionLifeEventSnapshot {
  return {
    event_type: eventSlug,
    event_label: formatLifeEventLabel(eventSlug),
    event_date: null,
    source,
    recorded_at: recordedAt,
  }
}

/**
 * Life event to attach when an advisor accepts a client connection.
 *
 * Priority (intentional — event landing beats calendar automation):
 * 1. `funnel_events.event_slug` for this user (`account_created` / `event_page_view`)
 * 2. Latest `referral_clicks.event_slug` for `profiles.referral_code` at signup
 * 3. Most recent explicit `life_events` (`source = user`, not calendar slug)
 * 4. Calendar-triggered life event (e.g. RMD age) as last resort
 */
export async function pickConnectionLifeEvent(
  admin: SupabaseClient,
  clientUserId: string,
): Promise<ConnectionLifeEventSnapshot | null> {
  const { data: funnelRow } = await admin
    .from('funnel_events')
    .select('event_slug, created_at')
    .eq('user_id', clientUserId)
    .not('event_slug', 'is', null)
    .in('event_name', ['account_created', 'event_page_view'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (funnelRow?.event_slug) {
    return snapshotFromSlug(
      funnelRow.event_slug,
      funnelRow.created_at ?? new Date().toISOString(),
      'funnel_event',
    )
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('referral_code')
    .eq('id', clientUserId)
    .maybeSingle()

  if (profile?.referral_code) {
    const { data: click } = await admin
      .from('referral_clicks')
      .select('event_slug, created_at')
      .eq('referral_code', profile.referral_code)
      .not('event_slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (click?.event_slug) {
      return snapshotFromSlug(
        click.event_slug,
        click.created_at ?? new Date().toISOString(),
        'referral_click',
      )
    }
  }

  const { data: rows } = await admin
    .from('life_events')
    .select('event_type, event_date, source, created_at')
    .eq('user_id', clientUserId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!rows?.length) return null

  const preferred =
    rows.find((r) => r.source === 'user' && !r.event_type.startsWith('calendar')) ??
    rows.find((r) => r.source === 'calendar_trigger') ??
    rows[0]

  if (!preferred?.event_type) return null

  return {
    event_type: preferred.event_type,
    event_label: formatLifeEventLabel(preferred.event_type),
    event_date: preferred.event_date ?? null,
    source: preferred.source ?? 'user',
    recorded_at: preferred.created_at ?? new Date().toISOString(),
  }
}
