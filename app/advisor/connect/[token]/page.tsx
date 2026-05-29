import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ token: string }>
}

export default async function AdvisorConnectPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('advisor_clients')
    .select('id, invited_email, status, invite_expires_at, client_id')
    .eq('invite_token', token)
    .eq('status', 'consumer_requested')
    .maybeSingle()

  if (!row) redirect('/advisor?error=invalid_connect')
  if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
    redirect('/advisor?error=expired_connect')
  }

  const { data: consumer } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', row.client_id)
    .maybeSingle()

  const consumerName = consumer?.full_name?.trim() || consumer?.email || 'A client'

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(
      `/signup?role=advisor&connect=${token}&email=${encodeURIComponent(row.invited_email ?? '')}`,
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'advisor' && profile.role !== 'financial_advisor')) {
    redirect('/dashboard?error=not-advisor')
  }

  if (user.email?.toLowerCase() !== row.invited_email?.toLowerCase()) {
    redirect('/advisor?error=email_mismatch')
  }

  await admin
    .from('advisor_clients')
    .update({ advisor_id: user.id })
    .eq('id', row.id)

  redirect(`/advisor?connect_claimed=${row.id}&consumer=${encodeURIComponent(consumerName)}`)
}
