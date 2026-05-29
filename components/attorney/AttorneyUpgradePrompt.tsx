'use client'

import Link from 'next/link'

interface AttorneyUpgradePromptProps {
  feature: 'client_cap' | 'pdf_export' | 'doc_dashboard'
  currentClientCount?: number
}

const FEATURE_COPY = {
  client_cap: {
    headline: "You've reached the 3-client limit on the free plan",
    body: 'Upgrade to Attorney Starter to manage up to 15 client households — or Attorney Growth for up to 50.',
    cta: 'Upgrade to add more clients',
  },
  pdf_export: {
    headline: 'Intake summary export is a paid feature',
    body: 'Export a formatted intake summary PDF to use as your client intake artifact — included in Attorney Starter and above.',
    cta: 'Upgrade to unlock PDF export',
  },
  doc_dashboard: {
    headline: 'Multi-client document tracking is a paid feature',
    body: 'See document status and gaps across all your clients at a glance — included in Attorney Starter and above.',
    cta: 'Upgrade to unlock the document dashboard',
  },
}

export function AttorneyUpgradePrompt({ feature }: AttorneyUpgradePromptProps) {
  const copy = FEATURE_COPY[feature]
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg text-amber-500">⚠</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">{copy.headline}</p>
          <p className="mt-1 text-sm text-amber-800">{copy.body}</p>
          <Link
            href="/attorney/billing"
            className="mt-3 inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
          >
            {copy.cta} →
          </Link>
        </div>
      </div>
    </div>
  )
}
