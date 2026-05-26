import type { SupabaseClient } from '@supabase/supabase-js'

/** Mark unread consumer strategy questions for this client as read when advisor opens the client workspace. */
export async function markClientStrategyQuestionsRead(
  supabase: SupabaseClient,
  advisorId: string,
  clientId: string,
) {
  const { data: rows } = await supabase
    .from('notifications')
    .select('id, metadata')
    .eq('user_id', advisorId)
    .eq('type', 'consumer_strategy_question')
    .eq('read', false)

  const ids = (rows ?? [])
    .filter((row) => {
      const meta = row.metadata as { client_id?: string } | null
      return meta?.client_id === clientId
    })
    .map((row) => row.id)

  if (ids.length === 0) return

  const now = new Date().toISOString()
  await supabase
    .from('notifications')
    .update({ read: true, read_at: now })
    .in('id', ids)
}
