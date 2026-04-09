// Sprint 63 - Client component for beneficiary portal view
'use client'

import { useState } from 'react'
import EstateFlowDiagram from '@/lib/components/EstateFlowDiagram'
import DigitalAssetSummary from './DigitalAssetSummary'
import type {
  AccessLevel,
  BeneficiaryRelationship,
  DigitalAsset,
} from '@/lib/types/beneficiary-grant'

interface Props {
  granteeRelationship: BeneficiaryRelationship
  accessLevel: AccessLevel
  initialSnapshot: Record<string, unknown> | null
  initialDigitalAssets: DigitalAsset[]
}

export default function BeneficiaryEstateView({
  granteeRelationship,
  accessLevel,
  initialSnapshot,
  initialDigitalAssets,
}: Props) {
  const [digitalAssets] = useState<DigitalAsset[]>(initialDigitalAssets)
  const [activeTab, setActiveTab] = useState<'overview' | 'digital'>('overview')

  const estateSnapshot = initialSnapshot

  const tabs = [
    { id: 'overview' as const, label: 'Estate Overview' },
    ...(granteeRelationship === 'executor' || accessLevel === 'full'
      ? [{ id: 'digital' as const, label: 'Digital Assets' }]
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
              type="button"
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
