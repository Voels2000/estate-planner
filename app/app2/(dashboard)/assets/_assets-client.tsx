'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AssetsTable } from './_assets-table'
import { AddAssetModal } from './_add-asset-modal'
import type { AssetRow } from '@/lib/validations/assets'

type Props = {
  assets: AssetRow[]
  ownerId: string
}

export function AssetsClient({ assets, ownerId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  function handleSuccess() {
    router.refresh()
  }

  return (
    <>
      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {assets.length} asset{assets.length !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Add asset
          </button>
        </div>
        <div className="mt-4">
          <AssetsTable assets={assets} />
        </div>
      </div>
      <AddAssetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        ownerId={ownerId}
      />
    </>
  )
}
