import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { sendMeetingPrepSharedEmail } from '@/lib/email/meetingPrepSharedEmail'
import { getAppUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value).toLocaleString()}`
}

export async function POST(request: Request) {
  const { user, isSuperuser, isAdvisor } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperuser && !isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { client_id, message } = (await request.json()) as {
    client_id?: string
    message?: string
  }

  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: link } = await admin
    .from('advisor_clients')
    .select('id, client_id')
    .eq('advisor_id', user.id)
    .eq('client_id', client_id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: 'Client not connected' }, { status: 404 })
  }

  const [{ data: advisorProfile }, { data: clientProfile }, { data: household }] = await Promise.all([
    admin.from('profiles').select('full_name, email').eq('id', user.id).single(),
    admin.from('profiles').select('full_name, email').eq('id', client_id).single(),
    admin.from('households').select('id').eq('owner_id', client_id).maybeSingle(),
  ])

  if (!clientProfile?.email) {
    return NextResponse.json({ error: 'Client email not found' }, { status: 404 })
  }

  let healthScore: number | null = null
  if (household?.id) {
    const { data: scoreRow } = await admin
      .from('estate_health_scores')
      .select('score')
      .eq('household_id', household.id)
      .maybeSingle()
    healthScore = scoreRow?.score ?? null
  }

  const { data: compositionCache } = household?.id
    ? await admin
        .from('estate_composition_cache')
        .select('composition')
        .eq('household_id', household.id)
        .eq('source_role', 'consumer')
        .maybeSingle()
    : { data: null }

  const grossEstate =
    compositionCache?.composition &&
    typeof compositionCache.composition === 'object' &&
    compositionCache.composition !== null &&
    'gross_estate' in compositionCache.composition
      ? Number((compositionCache.composition as { gross_estate?: number }).gross_estate ?? 0)
      : null

  const advisorLabel = advisorProfile?.full_name?.trim() || advisorProfile?.email || 'Your advisor'
  const appUrl = getAppUrl()

  try {
    await sendMeetingPrepSharedEmail({
      to: clientProfile.email,
      clientFirstName: clientProfile.full_name?.split(' ')[0] ?? 'there',
      advisorName: advisorLabel,
      dashboardUrl: `${appUrl}/dashboard`,
      healthScore,
      grossEstateLabel: grossEstate && grossEstate > 0 ? formatCurrency(grossEstate) : null,
      personalMessage: message?.trim() || null,
    })
  } catch (err) {
    console.error('share-meeting-prep email:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  try {
    await admin.rpc('create_notification', {
      p_user_id: client_id,
      p_type: 'estate_milestone',
      p_title: 'Your advisor shared a planning brief',
      p_body: `${advisorLabel} sent you a meeting prep summary. Review your dashboard for next steps.`,
      p_delivery: 'both',
      p_metadata: { advisor_id: user.id },
      p_cooldown: '1 hour',
    })
  } catch {}

  return NextResponse.json({ success: true })
}
