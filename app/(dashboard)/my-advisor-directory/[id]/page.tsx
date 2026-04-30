import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AdvisorDetailClient } from './_advisor-detail-client'

export default async function AdvisorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: advisor } = await supabase
    .from('advisor_directory')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (!advisor) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user!.id)
    .single()

  return (
    <AdvisorDetailClient
      advisor={advisor}
      userName={profile?.full_name ?? user!.email ?? ''}
      userEmail={user!.email ?? ''}
    />
  )
}
