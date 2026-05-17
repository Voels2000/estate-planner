'use client'

import { useState } from 'react'
import type { DigitalAsset } from '@/lib/types/beneficiary-grant'
import DigitalAssetIntakeForm from './_components/DigitalAssetIntakeForm'
import DigitalAssetList from './_components/DigitalAssetList'

interface Props {
  initialAssets: DigitalAsset[]
  householdId: string
}

export default function DigitalAssetsClient({ initialAssets, householdId }: Props) {
  const [assets, setAssets] = useState(initialAssets)

  function handleSaved(saved: DigitalAsset) {
    setAssets((prev) => [saved, ...prev])
  }

  return (
    <>
      <DigitalAssetList assets={assets} householdId={householdId} onDeleted={(id) => setAssets((prev) => prev.filter((a) => a.id !== id))} />
      <DigitalAssetIntakeForm householdId={householdId} onSaved={handleSaved} />
    </>
  )
}
