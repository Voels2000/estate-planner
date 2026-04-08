import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SharePageClient from './SharePageClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function EstateFlowSharePage({ params }: Props) {
  const { token } = await params

  console.log('Share page loaded, token:', token)

  const supabase = await createClient()

  const { data: link, error } = await supabase
    .from('estate_flow_share_links')
    .select('*')
    .eq('token', token)
    .single()

  console.log('Link query result:', JSON.stringify({ link: !!link, error }))

  if (error || !link) {
    console.log('Not found — returning 404')
    return notFound()
  }

  if (link.is_revoked) {
    return <ExpiredPage message="This estate planning summary is no longer available." />
  }

  if (new Date(link.expires_at) < new Date()) {
    return <ExpiredPage message="This link has expired." />
  }

  // Fetch snapshot separately
  const { data: snapshot, error: snapError } = await supabase
    .from('estate_flow_snapshots')
    .select('flow_data')
    .eq('id', link.snapshot_id)
    .single()

  console.log('Snapshot query result:', JSON.stringify({ snapshot: !!snapshot, snapError }))

  if (!snapshot) return notFound()

  const { data: household } = await supabase
    .from('households')
    .select('name, person1_name')
    .eq('id', link.household_id)
    .single()

  return (
    <SharePageClient
      flowData={snapshot.flow_data}
      householdName={household?.person1_name ?? household?.name ?? 'Estate Plan'}
      expiresAt={link.expires_at}
      token={token}
    />
  )
}

function ExpiredPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Link unavailable</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}
