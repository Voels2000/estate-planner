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
  } | null
  isSuperuser: boolean
  isAdmin: boolean
  isAdvisor: boolean
  isAttorney: boolean
  isConsumer: boolean
  hasActiveSubscription: boolean
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
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_superuser, subscription_status, consumer_tier, terms_accepted_at, terms_version')
    .eq('id', user.id)
    .single()

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
  }
}
