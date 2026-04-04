import { createClient } from '@/lib/supabase/server'

export type AccessContext = {
  user: { id: string; email: string } | null
  profile: {
    role: string
    is_superuser: boolean
    subscription_status: string | null
    consumer_tier: number | null
    terms_accepted_at: string | null
    terms_version: string | null
    firm_id: string | null
    firm_role: string | null
  } | null
  isSuperuser: boolean
  isAdmin: boolean
  isAdvisor: boolean
  isAttorney: boolean
  isConsumer: boolean
  hasActiveSubscription: boolean
  firm_id: string | null
  firm_role: string | null
  firm_name: string | null
  firm_tier: string | null
  seat_count: number | null
  isFirmOwner: boolean
}

export async function getAccessContext(): Promise<AccessContext> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null, profile: null,
      isSuperuser: false, isAdmin: false,
      isAdvisor: false, isAttorney: false,
      isConsumer: false, hasActiveSubscription: false,
      firm_id: null,
      firm_role: null,
      firm_name: null,
      firm_tier: null,
      seat_count: null,
      isFirmOwner: false,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_superuser, subscription_status, consumer_tier, terms_accepted_at, terms_version, firm_id, firm_role')
    .eq('id', user.id)
    .single()

  let firm: {
    id: string
    name: string
    tier: string
    seat_count: number
    subscription_status: string | null
  } | null = null

  if (profile?.firm_id) {
    const { data: firmRow } = await supabase
      .from('firms')
      .select('id, name, tier, seat_count, subscription_status')
      .eq('id', profile.firm_id)
      .single()
    firm = firmRow ?? null
  }

  const role = profile?.role ?? ''
  const isSuperuser = profile?.is_superuser === true

  return {
    user: { id: user.id, email: user.email ?? '' },
    profile,
    isSuperuser,
    isAdmin: isSuperuser || role === 'admin',
    isAdvisor: isSuperuser || role === 'advisor',
    isAttorney: role === 'attorney',
    isConsumer: role === 'consumer',
    hasActiveSubscription:
      profile?.subscription_status === 'active' ||
      profile?.subscription_status === 'trialing',
    firm_id: profile?.firm_id ?? null,
    firm_role: profile?.firm_role ?? null,
    firm_name: firm?.name ?? null,
    firm_tier: firm?.tier ?? null,
    seat_count: firm?.seat_count ?? null,
    isFirmOwner: profile?.firm_role === 'owner',
  }
}
