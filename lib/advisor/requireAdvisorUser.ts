import { getRouteAuth } from '@/lib/supabase/routeAuth'

export async function requireAdvisorUser() {
  const { supabase, user } = await getRouteAuth()

  if (!user) {
    return { supabase, user: null, error: 'Unauthorized' as const, status: 401 as const }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'advisor' && profile?.role !== 'financial_advisor') {
    return { supabase, user: null, error: 'Forbidden' as const, status: 403 as const }
  }

  return { supabase, user, error: null, status: 200 as const }
}
