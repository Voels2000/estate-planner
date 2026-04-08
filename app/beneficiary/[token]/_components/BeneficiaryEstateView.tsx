// Sprint 63 - Client component for beneficiary portal view
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import EstateFlowDiagram from '@/lib/components/EstateFlowDiagram'
import DigitalAssetSummary from './DigitalAssetSummary'
import type {
  AccessLevel,
  BeneficiaryRelationship,
  DigitalAsset,
} from '@/lib/types/beneficiary-grant'

interface Props {
  householdId: string
  granteeRelationship: BeneficiaryRelationship
  accessLevel: AccessLevel
  token: string
}

export default function BeneficiaryEstateView({
  householdId,
  granteeRelationship,
  accessLevel,
  token,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [estateSnapshot, setEstateSnapshot] = useState<Record<string, unknown> | null>(null)
  const [digitalAssets, setDigitalAssets] = useState<DigitalAsset[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'digital'>('overview')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      const { data: snapshot } = await supabase.rpc('get_snapshot_for_beneficiary', {
        p_token: token,
      })

      if (snapshot && !(snapshot as { error?: unknown }).error) {
        setEstateSnapshot(snapshot as Record<string, unknown>)
      }

      if (granteeRelationship === 'executor' || accessLevel === 'full') {
        const { data: assets } = await supabase
          .from('digital_assets')
          .select('id, household_id, asset_type, platform, description, estimated_value, executor_notes')
          .eq('household_id', householdId)

        setDigitalAssets((assets ?? []) as DigitalAsset[])
      }

      setLoading(false)
    }
    load()
  }, [householdId, granteeRelationship, accessLevel, token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Estate Overview' },
    ...(granteeRelationship === 'executor' || accessLevel === 'full'
      ? [{ id: 'digital', label: 'Digital Assets' }]
      : []),
  ] as { id: 'overview' | 'digital'; label: string }[]

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        You are viewing this estate plan as a{' '}
        <strong className="capitalize">{granteeRelationship}</strong>.
        {granteeRelationship === 'executor' && (
          <span>
            {' '}
            You have been designated as the digital executor and can view the digital asset
            inventory.
          </span>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="border-b flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estate Flow</h2>
            {estateSnapshot?.flow_data ? (
              <EstateFlowDiagram
                flowData={estateSnapshot.flow_data}
                deathView="s1_first"
                readOnly={true}
                highlightRelationship={granteeRelationship}
              />
            ) : (
              <p className="text-gray-500 text-sm">No estate flow snapshot available yet.</p>
            )}
          </div>

          <InheritancePositionCard snapshot={estateSnapshot} />
        </div>
      )}

      {activeTab === 'digital' && <DigitalAssetSummary assets={digitalAssets} />}
    </div>
  )
}

function InheritancePositionCard({
  snapshot,
}: {
  snapshot: Record<string, unknown> | null
}) {
  if (!snapshot) return null

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Inheritance Position</h2>
      <p className="text-sm text-gray-500 mb-4">
        Based on the estate flow snapshot. Actual amounts depend on asset values at time of
        distribution.
      </p>
      <p className="text-sm text-gray-600 italic">
        Your advisor will discuss specific distribution details with you directly. This view is
        provided for informational purposes only.
      </p>
    </div>
  )
}
