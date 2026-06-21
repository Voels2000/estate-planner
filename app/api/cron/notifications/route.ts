import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { sendNotificationEmail } from '@/lib/emails/send-notification-email'
import { recordCronHealth } from '@/lib/cron/recordCronHealth'
import {
  emailCaptureDripStep2Eligible,
  emailCaptureDripStep3Eligible,
  profileDripStep2Eligible,
  profileDripStep3Eligible,
  runDripFetch,
} from '@/lib/cron/dripEligibility'
import { EMAIL_FROM } from '@/lib/email/config'
import { requireCronAuth } from '@/lib/api/internalApiAuth'
import { resend } from '@/lib/resend'
import { NextResponse } from 'next/server'

const BASE_URL = 'https://mywealthmaps.com'

type AuthInfo = {
  email?: string
  last_sign_in_at?: string | null
  created_at: string
}

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
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

  // ── 5. Life event context — notify advisor of recent client events ────────
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

  // ── 6. Email drip — send step 2 (day 3) and step 3 (day 7) ─────────────
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

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

    if (emailCaptureDripStep2Eligible({ step1At, step2At, step3At }, { threeDaysAgo, sevenDaysAgo })) {
      await runDripFetch(
        `${BASE_URL}/api/email/drip`,
        {
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
        },
        results,
        `email-capture step 2 (${full.email})`,
      )
    }

    if (emailCaptureDripStep3Eligible({ step1At, step2At, step3At }, { sevenDaysAgo })) {
      await runDripFetch(
        `${BASE_URL}/api/email/drip`,
        {
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
        },
        results,
        `email-capture step 3 (${full.email})`,
      )
    }
  }

  // ── 7. Advisor activation drip — step 2 (day 3) and step 3 (day 7) ───────
  const { data: advisorDripCandidates } = await supabase
    .from('profiles')
    .select('id, advisor_drip_step_1_sent_at, advisor_drip_step_2_sent_at, advisor_drip_step_3_sent_at')
    .in('role', ['advisor', 'financial_advisor'])
    .is('advisor_drip_unsubscribed_at', null)
    .not('advisor_drip_step_1_sent_at', 'is', null)

  for (const advisor of advisorDripCandidates ?? []) {
    const step1At = advisor.advisor_drip_step_1_sent_at
      ? new Date(advisor.advisor_drip_step_1_sent_at)
      : null
    const step2At = advisor.advisor_drip_step_2_sent_at
      ? new Date(advisor.advisor_drip_step_2_sent_at)
      : null
    const step3At = advisor.advisor_drip_step_3_sent_at
      ? new Date(advisor.advisor_drip_step_3_sent_at)
      : null

    if (!step1At) continue

    if (profileDripStep2Eligible({ step1At, step2At, step3At }, { threeDaysAgo })) {
      await runDripFetch(
        `${BASE_URL}/api/email/advisor-drip`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
          },
          body: JSON.stringify({
            advisor_id: advisor.id,
            sequence_step: 2,
          }),
        },
        results,
        `advisor step 2 (${advisor.id})`,
      )
    }

    if (profileDripStep3Eligible({ step1At, step2At, step3At }, { sevenDaysAgo })) {
      await runDripFetch(
        `${BASE_URL}/api/email/advisor-drip`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
          },
          body: JSON.stringify({
            advisor_id: advisor.id,
            sequence_step: 3,
          }),
        },
        results,
        `advisor step 3 (${advisor.id})`,
      )
    }
  }

  // ── 8. Attorney activation drip — step 2 (day 3) and step 3 (day 7) ───────
  const { data: attorneyDripCandidates } = await supabase
    .from('profiles')
    .select(
      'id, email, created_at, role, is_attorney, attorney_drip_step_1_sent_at, attorney_drip_step_2_sent_at, attorney_drip_step_3_sent_at',
    )
    .not('attorney_drip_step_1_sent_at', 'is', null)
    .is('attorney_drip_unsubscribed_at', null)

  for (const attorney of attorneyDripCandidates ?? []) {
    const isAttorney = attorney.role === 'attorney' || attorney.is_attorney === true
    if (!isAttorney) continue

    const step1At = attorney.attorney_drip_step_1_sent_at
      ? new Date(attorney.attorney_drip_step_1_sent_at)
      : null
    const step2At = attorney.attorney_drip_step_2_sent_at
      ? new Date(attorney.attorney_drip_step_2_sent_at)
      : null
    const step3At = attorney.attorney_drip_step_3_sent_at
      ? new Date(attorney.attorney_drip_step_3_sent_at)
      : null

    if (!step1At) continue

    if (profileDripStep2Eligible({ step1At, step2At, step3At }, { threeDaysAgo })) {
      await runDripFetch(
        `${BASE_URL}/api/email/attorney-drip`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
          },
          body: JSON.stringify({
            attorney_id: attorney.id,
            sequence_step: 2,
          }),
        },
        results,
        `attorney step 2 (${attorney.id})`,
      )
    }

    if (profileDripStep3Eligible({ step1At, step2At, step3At }, { sevenDaysAgo })) {
      await runDripFetch(
        `${BASE_URL}/api/email/attorney-drip`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
          },
          body: JSON.stringify({
            attorney_id: attorney.id,
            sequence_step: 3,
          }),
        },
        results,
        `attorney step 3 (${attorney.id})`,
      )
    }
  }

  // ── 9. Attorney weekly digest — Fridays only, 6-day cooldown ────────────
  const isFriday = now.getUTCDay() === 5
  const sixDaysAgo = new Date(now)
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)

  if (isFriday) {
    const { data: digestCandidates } = await supabase
      .from('profiles')
      .select('id, email, role, is_attorney, attorney_digest_sent_at')
      .not('email', 'is', null)
      .or('role.eq.attorney,is_attorney.eq.true')

    for (const attorney of digestCandidates ?? []) {
      const isAttorney = attorney.role === 'attorney' || attorney.is_attorney === true
      if (!isAttorney) continue

      const lastSent = attorney.attorney_digest_sent_at
        ? new Date(attorney.attorney_digest_sent_at)
        : null
      if (lastSent && lastSent > sixDaysAgo) continue

      const res = await fetch(`${BASE_URL}/api/email/attorney-digest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
        },
        body: JSON.stringify({ attorney_id: attorney.id }),
      }).catch(() => null)

      if (res?.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          success?: boolean
          skipped?: boolean
        }
        if (payload.success) results.sent++
        else results.skipped++
      } else {
        results.errors++
      }
    }
  }

  // ── 10. State estate tax content staleness check — every Monday ──────────
  const isMonday = now.getUTCDay() === 1
  if (isMonday) {
    const complianceEmail = process.env.COMPLIANCE_EMAIL
    const { data: stateRows } = await supabase
      .from('state_estate_tax_content')
      .select('state_code, state_name, last_reviewed, law_effective_date')

    const overdueStates = (stateRows ?? []).filter((row) => {
      const days = Math.floor(
        (Date.now() - new Date(row.last_reviewed).getTime()) / (1000 * 60 * 60 * 24),
      )
      return days >= 180
    })

    if (overdueStates.length > 0 && complianceEmail) {
      const body = [
        'The following state estate tax content pages are due for review:',
        '',
        ...overdueStates.map(
          (s) => `  ${s.state_name} (${s.state_code}) — last reviewed: ${s.last_reviewed}`,
        ),
        '',
        'Review and update at: https://www.mywealthmaps.com/admin?tab=state_tax_content',
      ].join('\n')

      const { error: emailErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: complianceEmail,
        subject: `[MWM] ${overdueStates.length} state estate tax page(s) need review`,
        text: body,
        html: `<pre style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${body.replace(/</g, '&lt;')}</pre>`,
      })
      if (emailErr) {
        console.error('[cron:notifications] state tax content alert failed', emailErr)
        results.errors++
      } else {
        results.sent++
      }
    }
  }

  console.log('[cron:notifications]', results)
  const status = results.errors > 0 ? 'warning' : 'ok'
  await recordCronHealth(
    'notifications',
    status,
    `sent=${results.sent} errors=${results.errors}`,
  )
  return NextResponse.json({ ok: true, ...results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notifications cron failed'
    console.error('[cron:notifications]', message)
    await recordCronHealth('notifications', 'error', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
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
