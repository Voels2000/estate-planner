import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/** Upgrade profile role when outreach magic link carries attorney/advisor metadata (e.g. test inbox reuse). */
export async function syncOutreachProfessionalRole(user: User): Promise<void> {
  const metaRole = user.user_metadata?.role
  if (metaRole !== 'attorney' && metaRole !== 'advisor') return

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_attorney')
    .eq('id', user.id)
    .maybeSingle()

  if (metaRole === 'attorney' && profile?.role !== 'attorney') {
    await admin
      .from('profiles')
      .update({ role: 'attorney', is_attorney: true })
      .eq('id', user.id)
  } else if (metaRole === 'advisor' && profile?.role !== 'advisor') {
    await admin.from('profiles').update({ role: 'advisor' }).eq('id', user.id)
  }
}
