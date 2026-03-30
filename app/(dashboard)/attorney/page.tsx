import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AttorneyClient from './_attorney-client'

export default async function AttorneyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Role guard — attorney only
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'attorney') redirect('/dashboard')

  // Fetch all clients linked to this attorney
  const { data: attorneyClients } = await supabase
    .from('attorney_clients')
    .select(`
      id,
      status,
      created_at,
      client_id,
      request_message,
      profiles!attorney_clients_client_id_fkey (
        id,
        full_name,
        email,
        subscription_status,
        created_at
      )
    `)
    .eq('attorney_id', user.id)
    .neq('status', 'removed')
    .order('created_at', { ascending: false })

  return (
    <AttorneyClient
      attorneyClients={(attorneyClients ?? []).map(ac => ({
        ...ac,
        profiles: Array.isArray(ac.profiles) ? ac.profiles[0] ?? null : ac.profiles,
      }))}
      attorneyId={user.id}
    />
  )
}
