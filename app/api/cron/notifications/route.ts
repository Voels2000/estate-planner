import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { sendNotificationEmail } from '@/lib/emails/send-notification-email'
import { NextResponse } from 'next/server'

const BASE_URL = 'https://mywealthmaps.com'

type AuthInfo = {
  email?: string
  last_sign_in_at?: string | null
  created_at: string
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results = { sent: 0, skipped: 0, errors: 0 }

  const authMap = await loadAllAuthUsers(supabase)

  const staleThreshold = new Date(now)
  staleThreshold.setDate(staleThreshold.getDate() - 30)

  const mfaThreshold = new Date(now)
  mfaThreshold.setHours(mfaThreshold.getHours() - 24)

  const nudgeThreshold = new Date(now)
  nudgeThreshold.setDate(nudgeThreshold.getDate() - 7)

  // ── 1. Stale plan alert — no meaningful login in 30 days ───────────────
  const { data: activeForStale } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('subscription_status', 'active')

  for (const row of activeForStale ?? []) {
    const auth = authMap.get(row.id)
    if (!auth) continue
    const created = new Date(auth.created_at)
    const last = auth.last_sign_in_at ? new Date(auth.last_sign_in_at) : null
    const isStale = last ? last < staleThreshold : created < staleThreshold
    if (!isStale) continue

    const to = row.email ?? auth.email
    if (!to) continue

    const notifId = await callCreateNotification(supabase, {
      user_id: row.id,
      type: 'stale_plan',
      title: 'Your estate plan needs attention',
      body: "It's been over 30 days since you last reviewed your plan. Life changes — keep your estate plan current.",
    })
    if (notifId) {
      const r = await sendNotificationEmail({
        to,
        type: 'stale_plan',
        title: 'Your estate plan needs attention',
        body: "It's been over 30 days since you last reviewed your plan. Life changes — keep your estate plan current.",
      })
      if (r.ok) results.sent++
      else results.errors++
    } else {
      results.skipped++
    }
  }

  // ── 2. Estate milestone — net worth crosses $1M / $5M / $13.61M ─────────
  const MILESTONES: { amount: number; typeSuffix: string; label: string }[] = [
    { amount: 1_000_000, typeSuffix: '1m', label: '$1M' },
    { amount: 5_000_000, typeSuffix: '5m', label: '$5M' },
    {
      amount: 13_610_000,
      typeSuffix: 'estate_tax',
      label: 'Federal estate tax threshold',
    },
  ]

  const { data: milestoneProfiles } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('subscription_status', 'active')
    .eq('role', 'consumer')

  const consumerIds = (milestoneProfiles ?? []).map((p) => p.id)
  const nwMap = await netWorthByOwnerId(supabase, consumerIds)

  for (const profile of milestoneProfiles ?? []) {
    const nw = nwMap.get(profile.id) ?? 0
    const to = profile.email ?? authMap.get(profile.id)?.email
    if (!to) continue

    for (const { amount, typeSuffix, label } of MILESTONES) {
      if (nw < amount) continue

      const notifId = await callCreateNotification(supabase, {
        user_id: profile.id,
        type: `estate_milestone_${typeSuffix}`,
        title: `Milestone reached: ${label}`,
        body: `Your estimated net worth has crossed ${label}. Review your estate plan to ensure it reflects your current situation.`,
        metadata: { milestone: amount, milestone_label: label },
        cooldown: '90 days',
      })
      if (notifId) {
        const r = await sendNotificationEmail({
          to,
          type: 'estate_milestone',
          title: `Milestone reached: ${label}`,
          body: `Your estimated net worth has crossed ${label}. Review your estate plan to ensure it reflects your current situation.`,
          metadata: { milestone_label: label },
        })
        if (r.ok) results.sent++
        else results.errors++
      } else {
        results.skipped++
      }
    }
  }

  // ── 3. MFA reminder — enrolled > 24hrs ago, MFA still not set up ────────
  const { data: mfaProfiles } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('subscription_status', 'active')

  for (const row of mfaProfiles ?? []) {
    const auth = authMap.get(row.id)
    if (!auth) continue
    if (new Date(auth.created_at) >= mfaThreshold) continue

    const { data: factorData, error: factorErr } =
      await supabase.auth.admin.mfa.listFactors({ userId: row.id })
    if (factorErr) {
      console.error('[cron] listFactors', row.id, factorErr.message)
      results.errors++
      continue
    }
    const hasMfa = (factorData?.factors ?? []).some((f) => f.status === 'verified')
    if (hasMfa) continue

    const to = row.email ?? auth.email
    if (!to) continue

    const notifId = await callCreateNotification(supabase, {
      user_id: row.id,
      type: 'mfa_reminder',
      title: 'Secure your account with two-factor authentication',
      body: 'Add an extra layer of security to protect your estate planning data. It only takes 2 minutes.',
      cooldown: '14 days',
    })
    if (notifId) {
      const r = await sendNotificationEmail({
        to,
        type: 'mfa_reminder',
        title: 'Secure your account with two-factor authentication',
        body: 'Add an extra layer of security to protect your estate planning data. It only takes 2 minutes.',
      })
      if (r.ok) results.sent++
      else results.errors++
    } else {
      results.skipped++
    }
  }

  // ── 4. Plan completion nudge — profile < 50% complete after 7 days ──────
  const { data: nudgeProfiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('subscription_status', 'active')
    .eq('role', 'consumer')

  const nudgeIds = (nudgeProfiles ?? []).map((p) => p.id)
  const { data: nudgeHouseholds } =
    nudgeIds.length > 0
      ? await supabase
          .from('households')
          .select('owner_id, person1_name, person1_birth_year, state_primary')
          .in('owner_id', nudgeIds)
      : { data: [] as { owner_id: string; person1_name: string | null; person1_birth_year: number | null; state_primary: string | null }[] }

  const hhByOwner = new Map(
    (nudgeHouseholds ?? []).map((h) => [h.owner_id, h])
  )

  for (const user of nudgeProfiles ?? []) {
    const auth = authMap.get(user.id)
    if (!auth) continue
    if (new Date(auth.created_at) >= nudgeThreshold) continue

    const hh = hhByOwner.get(user.id)
    const fields = [
      user.full_name,
      hh?.person1_name,
      hh?.person1_birth_year != null ? String(hh.person1_birth_year) : '',
      hh?.state_primary,
    ]
    const filled = fields.filter(Boolean).length
    const pct = (filled / fields.length) * 100
    if (pct >= 50) continue

    const to = user.email ?? auth.email
    if (!to) continue

    const notifId = await callCreateNotification(supabase, {
      user_id: user.id,
      type: 'plan_completion_nudge',
      title: 'Complete your estate plan profile',
      body: 'Your profile is less than 50% complete. A complete profile gives you more accurate projections and recommendations.',
      cooldown: '14 days',
    })
    if (notifId) {
      const r = await sendNotificationEmail({
        to,
        type: 'plan_completion_nudge',
        title: 'Complete your estate plan profile',
        body: 'Your profile is less than 50% complete. A complete profile gives you more accurate projections and recommendations.',
      })
      if (r.ok) results.sent++
      else results.errors++
    } else {
      results.skipped++
    }
  }

  // ── 5. Subscription renewal reminder — 7 days before renewal ──────────
  const renewalStart = new Date(now)
  const renewalEnd = new Date(now)
  renewalStart.setDate(renewalStart.getDate() + 7)
  renewalEnd.setDate(renewalEnd.getDate() + 8)

  const { data: renewalUsers } = await supabase
    .from('profiles')
    .select('id, email, subscription_renewal_date')
    .gte('subscription_renewal_date', renewalStart.toISOString())
    .lt('subscription_renewal_date', renewalEnd.toISOString())
    .eq('subscription_status', 'active')

  for (const user of renewalUsers ?? []) {
    const to = user.email ?? authMap.get(user.id)?.email
    if (!to) continue

    const notifId = await callCreateNotification(supabase, {
      user_id: user.id,
      type: 'subscription_renewal',
      title: 'Your subscription renews in 7 days',
      body: 'Your WealthMaps subscription will automatically renew in 7 days. Visit billing to manage your plan.',
      delivery: 'email',
      cooldown: '30 days',
    })
    if (notifId) {
      const r = await sendNotificationEmail({
        to,
        type: 'subscription_renewal',
        title: 'Your subscription renews in 7 days',
        body: 'Your WealthMaps subscription will automatically renew in 7 days. Visit billing to manage your plan.',
      })
      if (r.ok) results.sent++
      else results.errors++
    } else {
      results.skipped++
    }
  }

  // ── 6. Life event context — notify advisor of recent client events ────────
  const oneDayAgo = new Date(now)
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { data: recentLifeEvents } = await supabase
    .from('life_events')
    .select('id, user_id, event_type, created_at')
    .eq('source', 'user')
    .gte('created_at', oneDayAgo.toISOString())

  for (const event of recentLifeEvents ?? []) {
    const { data: connection } = await supabase
      .from('advisor_clients')
      .select('advisor_id')
      .eq('client_id', event.user_id)
      .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
      .maybeSingle()

    if (!connection?.advisor_id) continue

    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', event.user_id)
      .single()

    const clientName = clientProfile?.full_name
      ?? clientProfile?.email
      ?? 'Your client'

    const eventLabel = event.event_type
      .split('-')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    const notifId = await callCreateNotification(supabase, {
      user_id: connection.advisor_id,
      type: `client_life_event_${event.id}`,
      title: `${clientName} logged a life event`,
      body: `${clientName} indicated: ${eventLabel}. Review their plan to see what may need attention.`,
      metadata: {
        client_id: event.user_id,
        life_event_id: event.id,
        event_type: event.event_type,
      },
      cooldown: '23 hours',
    })

    if (notifId) results.sent++
    else results.skipped++
  }

  // ── 7. Email drip — send step 2 (day 3) and step 3 (day 7) ─────────────
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const eightDaysAgo = new Date(now)
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

  const { data: dripCandidates } = await supabase
    .from('email_captures')
    .select('email, source')
    .is('unsubscribed_at', null)

  for (const capture of dripCandidates ?? []) {
    const { data: full } = await supabase
      .from('email_captures')
      .select('email, source, drip_step_1_sent_at, drip_step_2_sent_at, drip_step_3_sent_at')
      .eq('email', capture.email)
      .eq('source', capture.source)
      .single()

    if (!full) continue

    const step1At = full.drip_step_1_sent_at ? new Date(full.drip_step_1_sent_at) : null
    const step2At = full.drip_step_2_sent_at ? new Date(full.drip_step_2_sent_at) : null
    const step3At = full.drip_step_3_sent_at ? new Date(full.drip_step_3_sent_at) : null

    const eventSlug = full.source?.replace('event-assess-', '') ?? null

    if (step1At && !step2At && step1At >= sevenDaysAgo && step1At < threeDaysAgo) {
      await fetch(`${BASE_URL}/api/email/drip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
        },
        body: JSON.stringify({
          email: full.email,
          source: full.source,
          event_slug: eventSlug,
          sequence_step: 2,
        }),
      }).catch(() => {})
      results.sent++
    }

    if (step1At && step2At && !step3At && step1At >= eightDaysAgo && step1At < sevenDaysAgo) {
      await fetch(`${BASE_URL}/api/email/drip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
        },
        body: JSON.stringify({
          email: full.email,
          source: full.source,
          event_slug: eventSlug,
          sequence_step: 3,
        }),
      }).catch(() => {})
      results.sent++
    }
  }

  console.log('[cron:notifications]', results)
  return NextResponse.json({ ok: true, ...results })
}

async function loadAllAuthUsers(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, AuthInfo>> {
  const map = new Map<string, AuthInfo>()
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const users = data?.users ?? []
    for (const u of users) {
      map.set(u.id, {
        email: u.email,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
      })
    }
    if (users.length < 1000) break
    page++
  }
  return map
}

async function netWorthByOwnerId(
  supabase: ReturnType<typeof createAdminClient>,
  ownerIds: string[]
): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  if (ownerIds.length === 0) return m
  for (const id of ownerIds) m.set(id, 0)

  const [{ data: assets }, { data: liabilities }] = await Promise.all([
    supabase.from('assets').select('owner_id, value').in('owner_id', ownerIds),
    supabase.from('liabilities').select('owner_id, balance').in('owner_id', ownerIds),
  ])

  for (const a of assets ?? []) {
    const id = a.owner_id as string
    m.set(id, (m.get(id) ?? 0) + (Number(a.value) || 0))
  }
  for (const l of liabilities ?? []) {
    const id = l.owner_id as string
    m.set(id, (m.get(id) ?? 0) - (Number(l.balance) || 0))
  }
  return m
}

async function callCreateNotification(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    user_id: string
    type: string
    title: string
    body: string
    metadata?: Record<string, unknown>
    delivery?: string
    cooldown?: string
  }
): Promise<string | null> {
  const { data, error } = await supabase.rpc('create_notification', {
    p_user_id: params.user_id,
    p_type: params.type,
    p_title: params.title,
    p_body: params.body,
    p_delivery: params.delivery ?? 'both',
    p_metadata: params.metadata ?? {},
    p_cooldown: params.cooldown ?? '7 days',
  })

  if (error) {
    console.error('[cron] create_notification error:', error.message)
    return null
  }
  return data as string | null
}
