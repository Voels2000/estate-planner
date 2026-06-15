import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { displayPersonFirstName } from '@/lib/display-person-name'
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

  const { data: linkMeta, error: metaError } = await supabase.rpc('get_share_link_display_meta', {
    p_token: token,
  })

  if (metaError || !linkMeta || typeof linkMeta !== 'object') return notFound()

  const linkRow = linkMeta as {
    household_id: string
    expires_at: string
    is_revoked: boolean
    created_at: string
    household_name: string | null
  }

  if (linkRow.is_revoked) return notFound()
  if (new Date(linkRow.expires_at) < new Date()) {
    return <ExpiredPage message="This link has expired." />
  }

  return (
    <SharePageClient
      flowData={flowData}
      householdName={
        displayPersonFirstName(linkRow.household_name) || linkRow.household_name || 'Estate Plan'
      }
      expiresAt={linkRow.expires_at}
      generatedAt={linkRow.created_at}
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
