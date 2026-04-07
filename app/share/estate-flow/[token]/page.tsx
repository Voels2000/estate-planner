// app/share/estate-flow/[token]/page.tsx
// Sprint 60 — Public estate flow share page
// No authentication required. Renders estate structure only — no financial account values.
// 90-day expiry enforced server-side.

import { createClient } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import SharePageClient from './SharePageClient'

interface Props {
  params: { token: string }
}

export default async function EstateFlowSharePage({ params }: Props) {
  const { token } = params

  // Use service role or anon key — this is a public page
  const supabase = createClient()

  // Load share link
  const { data: link, error } = await supabase
    .from('estate_flow_share_links')
    .select('*, estate_flow_snapshots(flow_data), households(name, person1_name)')
    .eq('token', token)
    .single()

  if (error || !link) return notFound()

  // Revoked
  if (link.is_revoked) {
    return <ExpiredPage message="This estate planning summary is no longer available. Please contact the account holder or their advisor for current information." />
  }

  // Expired
  if (new Date(link.expires_at) < new Date()) {
    return <ExpiredPage message="This link has expired. Please contact the advisor for an updated link." />
  }

  const flowData = (link.estate_flow_snapshots as { flow_data: unknown })?.flow_data
  const householdName = (link.households as { name: string; person1_name: string | null })?.person1_name
    ?? (link.households as { name: string })?.name
    ?? 'Estate Plan'

  if (!flowData) return notFound()

  return (
    <SharePageClient
      flowData={flowData}
      householdName={householdName}
      expiresAt={link.expires_at}
      token={token}
    />
  )
}

function ExpiredPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Link unavailable</h1>
        <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
      </div>
    </div>
  )
}
