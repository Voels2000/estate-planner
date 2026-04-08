// Sprint 63 - Read-only digital asset summary for beneficiary/executor view
'use client'

import type { DigitalAsset, DigitalAssetType } from '@/lib/types/beneficiary-grant'

const ASSET_TYPE_LABELS: Record<DigitalAssetType, string> = {
  cryptocurrency: 'Cryptocurrency',
  nft: 'NFT / Digital Art',
  financial_account: 'Online Account',
  domain: 'Domain Name',
  streaming: 'Digital Media',
}

const ASSET_TYPE_ICONS: Record<DigitalAssetType, string> = {
  cryptocurrency: 'BTC',
  nft: 'ART',
  financial_account: 'ACC',
  domain: 'WEB',
  streaming: 'MED',
}

interface Props {
  assets: DigitalAsset[]
}

export default function DigitalAssetSummary({ assets }: Props) {
  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
        <p className="text-gray-500">No digital assets have been catalogued yet.</p>
      </div>
    )
  }

  const totalValue = assets.reduce((sum, a) => sum + (a.estimated_value ?? 0), 0)

  const byType = assets.reduce<Partial<Record<DigitalAssetType, DigitalAsset[]>>>((acc, a) => {
    acc[a.asset_type] = [...(acc[a.asset_type] ?? []), a]
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Digital Asset Inventory</h2>
        <p className="text-sm text-gray-500 mb-4">
          As digital executor you have been granted access to this inventory.
        </p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Assets</p>
            <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
          </div>
          {totalValue > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Est. Total Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalValue.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {(Object.entries(byType) as [DigitalAssetType, DigitalAsset[]][]).map(([type, typeAssets]) => (
        <div key={type} className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>{ASSET_TYPE_ICONS[type]}</span>
            <span>{ASSET_TYPE_LABELS[type]}</span>
            <span className="ml-auto text-xs font-normal text-gray-400">
              {typeAssets.length} item{typeAssets.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <div className="space-y-3">
            {typeAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-start justify-between border-t pt-3 first:border-t-0 first:pt-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{asset.platform}</p>
                  <p className="text-xs text-gray-500">{asset.description}</p>
                  {asset.executor_notes && (
                    <p className="text-xs text-blue-700 mt-1 bg-blue-50 rounded px-2 py-1">
                      Note: {asset.executor_notes}
                    </p>
                  )}
                </div>
                {asset.estimated_value != null && (
                  <p className="text-sm font-semibold text-gray-900 ml-4 shrink-0">
                    {asset.estimated_value.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
