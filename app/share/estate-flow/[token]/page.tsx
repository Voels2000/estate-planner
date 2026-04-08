import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SharePageClient from './SharePageClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function EstateFlowSharePage({ params }: Props) {
  const supabase = await createClient()
  const { token } = await params

  // Single RPC that validates the link and returns snapshot data
  const { data: flowData, error } = await supabase
    .rpc('get_snapshot_for_share_link', { p_token: token })

  console.log('RPC result:', JSON.stringify({ hasData: !!flowData, error }))

  if (error || !flowData) return notFound()

  // Still fetch household name for display
  const { data: linkRow } = await supabase
    .from('estate_flow_share_links')
    .select('household_id, expires_at, is_revoked')
    .eq('token', token)
    .single()

  if (!linkRow || linkRow.is_revoked) return notFound()
  if (new Date(linkRow.expires_at) < new Date()) {
    return <ExpiredPage message="This link has expired." />
  }

  const { data: household } = await supabase
    .from('households')
    .select('name, person1_name')
    .eq('id', linkRow.household_id)
    .single()

  return (
    <SharePageClient
      flowData={flowData}
      householdName={household?.person1_name ?? household?.name ?? 'Estate Plan'}
      expiresAt={linkRow.expires_at}
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
