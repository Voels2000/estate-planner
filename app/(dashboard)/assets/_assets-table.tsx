'use client'

import type { AssetRow } from '@/lib/validations/assets'
import { assetTypeLabels, parseDetails } from '@/lib/validations/assets'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

type Props = {
  assets: AssetRow[]
}

export function AssetsTable({ assets }: Props) {
  if (assets.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No assets yet. Add your first asset to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-900/80">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Type
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Value
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Details
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
          {assets.map((asset) => {
            const details = parseDetails(asset.details)
            const detailsDisplay = getDetailsDisplay(asset.type, details)
            return (
              <tr key={asset.id} className="text-zinc-900 dark:text-zinc-100">
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {assetTypeLabels[asset.type]}
                </td>
                <td className="px-4 py-3 text-sm font-medium">{asset.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                  {formatCurrency(Number(asset.value))}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {detailsDisplay}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function getDetailsDisplay(
  type: AssetRow['type'],
  details: Record<string, unknown>
): string {
  const parts: string[] = []
  if (details.address) parts.push(String(details.address))
  if (details.mortgage_balance != null && details.mortgage_balance !== '')
    parts.push(`Mortgage: ${formatCurrency(Number(details.mortgage_balance))}`)
  if (details.institution) parts.push(String(details.institution))
  if (details.employer_match_pct != null && details.employer_match_pct !== '')
    parts.push(`Match: ${details.employer_match_pct}%`)
  return parts.join(' · ') || '—'
}
