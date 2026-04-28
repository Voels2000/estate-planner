// Sprint 63 - Public beneficiary estate view (no auth required)
// Mirrors /share/estate-flow/[token] pattern from Sprint 60

import { createClient } from '@/lib/supabase/server'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import BeneficiaryEstateView from './_components/BeneficiaryEstateView'
import type { BeneficiaryGrantTokenPayload, DigitalAsset } from '@/lib/types/beneficiary-grant'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function BeneficiaryTokenPage({ params }: PageProps) {
  const { token } = await params // Next.js 15 pattern

  const supabase = await createClient()

  // Use the SECURITY DEFINER RPC so no auth is required
  const { data: grantPayload, error } = await supabase.rpc('get_grant_for_token', {
    p_token: token,
  })

  if (error || !grantPayload || grantPayload.error) {
    // Invalid, expired, or revoked token
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Link Unavailable</h1>
          <p className="text-gray-600">
            {grantPayload?.error === 'invalid_or_expired_token'
              ? 'This estate plan link has expired or been revoked.'
              : 'This link is invalid.'}
          </p>
        </div>
      </div>
    )
  }

  const grant = grantPayload as BeneficiaryGrantTokenPayload

  const { data: snapshotRaw } = await supabase.rpc('get_snapshot_for_beneficiary', {
    p_token: token,
  })
  const snapshotError =
    snapshotRaw && typeof snapshotRaw === 'object' && 'error' in snapshotRaw
      ? (snapshotRaw as { error?: string }).error
      : undefined
  const initialSnapshot =
    snapshotRaw && !snapshotError && typeof snapshotRaw === 'object'
      ? (snapshotRaw as Record<string, unknown>)
      : null

  let initialDigitalAssets: DigitalAsset[] = []
  if (grant.relationship === 'executor' || grant.access_level === 'full') {
    const { data: digitalRows } = await supabase
      .from('digital_assets')
      .select('id, household_id, asset_type, platform, description, estimated_value, executor_notes')
      .eq('household_id', grant.household_id)
    initialDigitalAssets = (digitalRows ?? []) as DigitalAsset[]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DisclaimerBanner />

      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Shared Estate Plan</p>
            <h1 className="text-xl font-semibold text-gray-900">Hello, {grant.grantee_name}</h1>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>
              Access level: <span className="capitalize font-medium">{grant.access_level}</span>
            </p>
            {grant.expires_at && <p>Expires: {new Date(grant.expires_at).toLocaleDateString()}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <BeneficiaryEstateView
          granteeRelationship={grant.relationship}
          accessLevel={grant.access_level}
          initialSnapshot={initialSnapshot}
          initialDigitalAssets={initialDigitalAssets}
        />
      </main>
    </div>
  )
}
