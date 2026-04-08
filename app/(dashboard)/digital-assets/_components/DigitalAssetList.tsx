'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { DigitalAsset, DigitalAssetType } from '@/lib/types/beneficiary-grant'

const ASSET_TYPE_ICONS: Record<DigitalAssetType, string> = {
  cryptocurrency: 'BTC',
  nft: 'ART',
  financial_account: 'ACC',
  domain: 'WEB',
  streaming: 'MED',
}

interface Props {
  assets: DigitalAsset[]
  householdId: string
}

export default function DigitalAssetList({ assets, householdId }: Props) {
  const supabase = createClient()
  const router = useRouter()

  async function handleDelete(id: string) {
    const ok = window.confirm('Delete this digital asset?')
    if (!ok) return

    await supabase
      .from('digital_assets')
      .delete()
      .eq('id', id)
      .eq('household_id', householdId)

    router.refresh()
  }

  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <p className="text-sm text-gray-500">No digital assets saved yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Digital Assets</h2>
      <div className="space-y-3">
        {assets.map((asset) => (
          <div key={asset.id} className="flex items-start justify-between border rounded-lg p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {ASSET_TYPE_ICONS[asset.asset_type]} {asset.platform}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{asset.description || 'No description'}</p>
              {asset.estimated_value != null && (
                <p className="text-xs text-gray-700 mt-1">
                  {asset.estimated_value.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  })}
                </p>
              )}
            </div>
            <button
              onClick={() => handleDelete(asset.id)}
              className="text-xs text-red-600 hover:underline ml-3 shrink-0"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
