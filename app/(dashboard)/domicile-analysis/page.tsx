import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { redirect } from 'next/navigation'
import DomicileAnalysisClient from './_domicile-analysis-client'

export const metadata = { title: 'Multi-State Domicile Analysis' }

export default async function DomicileAnalysisPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier')
    .eq('id', user.id)
    .single()

  const access = await getUserAccess()
  const isAdmin = profile?.role === 'admin'
  const isAdvisor = profile?.role === 'advisor'
  if (!isAdmin && !isAdvisor && access.tier < 3) {
    redirect('/billing?returnTo=/domicile-analysis')
  }

  const { data: analysis } = await supabase
    .from('domicile_analysis')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: checklistItems } = analysis
    ? await supabase
        .from('domicile_checklist_items')
        .select('*')
        .eq('analysis_id', analysis.id)
        .order('priority', { ascending: false })
        .order('category', { ascending: true })
    : { data: [] }

  let clients: { id: string; full_name: string; email: string }[] = []
  if (isAdvisor) {
    const { data: advisorClients } = await supabase
      .from('advisor_clients')
      .select(
        'client_id, profiles!advisor_clients_client_id_fkey(id, full_name, email)'
      )
      .eq('advisor_id', user.id)
      .eq('status', 'active')

    clients = (advisorClients ?? []).map((ac) => {
      const raw = ac.profiles as
        | { id: string; full_name: string | null; email: string | null }
        | { id: string; full_name: string | null; email: string | null }[]
        | null
      const p = Array.isArray(raw) ? raw[0] : raw
      return {
        id: p?.id ?? ac.client_id,
        full_name: p?.full_name ?? '',
        email: p?.email ?? '',
      }
    })
  }

  return (
    <DomicileAnalysisClient
      initialAnalysis={analysis}
      initialChecklist={checklistItems ?? []}
      role={profile?.role ?? 'consumer'}
      clients={clients}
      userId={user.id}
    />
  )
}
