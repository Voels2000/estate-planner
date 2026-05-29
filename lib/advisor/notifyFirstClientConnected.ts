import type { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

type AdminClient = ReturnType<typeof createAdminClient>

export async function notifyAdvisorFirstClientConnected(
  admin: AdminClient,
  params: {
    advisorId: string
    clientId: string
    clientName: string | null
  },
): Promise<void> {
  const { count } = await admin
    .from('advisor_clients')
    .select('*', { count: 'exact', head: true })
    .eq('advisor_id', params.advisorId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .not('accepted_at', 'is', null)

  if ((count ?? 0) !== 1) return

  await admin.rpc('create_notification', {
    p_user_id: params.advisorId,
    p_type: 'first_client_connected',
    p_title: `${params.clientName?.trim() || 'Your first client'} has joined`,
    p_body:
      'Start by reviewing their estate health score, then model a strategy from the Strategy tab.',
    p_delivery: 'both',
    p_metadata: {
      client_id: params.clientId,
      playbook_triggered: true,
      link: `/advisor/clients/${params.clientId}`,
    },
    p_cooldown: '0 seconds',
  })
}
