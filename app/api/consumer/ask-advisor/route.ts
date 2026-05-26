import { NextRequest, NextResponse } from 'next/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { createClient } from '@/lib/supabase/server'

type AskAdvisorBody = {
  strategy_name?: string
  strategy_type?: string
  note?: string
}

function formatStrategyLabel(strategyType: string, strategyName?: string): string {
  if (strategyName?.trim()) return strategyName.trim()
  return strategyType
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as AskAdvisorBody
  const strategyType = typeof body.strategy_type === 'string' ? body.strategy_type.trim() : ''
  const strategyName = typeof body.strategy_name === 'string' ? body.strategy_name.trim() : ''

  if (!strategyType) {
    return NextResponse.json({ error: 'strategy_type required' }, { status: 400 })
  }

  const displayName = formatStrategyLabel(strategyType, strategyName || STRATEGY_LABELS[strategyType])

  const { data: connection } = await supabase
    .from('advisor_clients')
    .select('advisor_id')
    .eq('client_id', user.id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  if (!connection?.advisor_id) {
    return NextResponse.json({ hasAdvisor: false })
  }

  const [{ data: clientProfile }, { data: advisorProfile }, { data: household }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
    supabase.from('profiles').select('full_name, email').eq('id', connection.advisor_id).single(),
    supabase.from('households').select('id').eq('owner_id', user.id).maybeSingle(),
  ])

  const clientName = clientProfile?.full_name ?? clientProfile?.email ?? 'Your client'
  const advisorName =
    advisorProfile?.full_name?.trim() ||
    advisorProfile?.email?.split('@')[0] ||
    'Your advisor'

  const planUrl = `/advisor/clients/${user.id}?tab=strategy`
  const noteSuffix = body.note?.trim() ? ` Note: ${body.note.trim()}` : ''

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()

    const { error: notifyError } = await adminClient.rpc('create_notification', {
      p_user_id: connection.advisor_id,
      p_type: 'consumer_strategy_question',
      p_title: `${clientName} is asking about ${displayName}`,
      p_body: `Your client has a question about the ${displayName} strategy in their estate plan. Review their current plan and consider adding a strategy recommendation.${noteSuffix}`,
      p_delivery: 'both',
      p_metadata: {
        strategy_type: strategyType,
        strategy_name: displayName,
        client_id: user.id,
        household_id: household?.id ?? null,
        plan_url: planUrl,
      },
      // Allow separate strategy questions in the same session (no type-level throttle).
      p_cooldown: '0 seconds',
    })

    if (notifyError) {
      console.error('[ask-advisor] create_notification failed:', notifyError)
    }
  } catch (err) {
    console.error('[ask-advisor] notify advisor error:', err)
  }

  return NextResponse.json({ hasAdvisor: true, advisorName })
}

const STRATEGY_LABELS: Record<string, string> = {
  grat: 'Grantor Retained Annuity Trust',
  crt: 'Charitable Remainder Trust',
  clat: 'Charitable Lead Annuity Trust',
  daf: 'Donor Advised Fund',
  liquidity: 'Liquidity Planning',
  roth: 'Roth Conversion',
  slat: 'Spousal Lifetime Access Trust',
  ilit: 'Irrevocable Life Insurance Trust',
}
