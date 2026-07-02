import type { SupabaseClient } from '@supabase/supabase-js'

export type BootstrapAdvisorFirmResult = {
  firmId: string
  created: boolean
}

/** Create owner firm + member row for a new advisor (Path A / connection billing seed). */
export async function bootstrapAdvisorFirm(
  admin: SupabaseClient,
  userId: string,
  email: string,
  firmName?: string,
): Promise<BootstrapAdvisorFirmResult | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('role, firm_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role !== 'advisor' || profile.firm_id != null) {
    return profile?.firm_id ? { firmId: profile.firm_id, created: false } : null
  }

  const prefix = email.includes('@')
    ? email.slice(0, email.indexOf('@')).trim()
    : email.trim() || 'Advisor'
  const name = firmName?.trim() || `${prefix} Firm`

  const { data: newFirm, error: firmError } = await admin
    .from('firms')
    .insert({
      name,
      owner_id: userId,
      tier: 'starter',
      seat_count: 1,
      subscription_status: null,
      client_limit: 1,
      billing_floor: 0,
      reset_count: 0,
    })
    .select('id')
    .single()

  if (firmError || !newFirm?.id) {
    console.error('advisor firm bootstrap error:', firmError)
    return null
  }

  const now = new Date().toISOString()
  const { error: memberError } = await admin.from('firm_members').insert({
    firm_id: newFirm.id,
    user_id: userId,
    firm_role: 'owner',
    status: 'active',
    joined_at: now,
  })
  if (memberError) {
    console.error('advisor firm member bootstrap error:', memberError)
    return null
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ firm_id: newFirm.id, firm_role: 'owner' })
    .eq('id', userId)
  if (profileError) {
    console.error('advisor firm profile bootstrap error:', profileError)
  }

  return { firmId: newFirm.id, created: true }
}
