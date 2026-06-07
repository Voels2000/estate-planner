'use client'

import { useState } from 'react'
import { CUSTODIAN_IMPORT_GUIDES } from '@/lib/import/custodianImportGuides'

export function CustodianExportGuides() {
  const [openId, setOpenId] = useState<string | null>(CUSTODIAN_IMPORT_GUIDES[0]?.id ?? null)

  return (
    <div className="mb-6 rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-[color:var(--mwm-off-white)] p-5">
      <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
        Export from your custodian (no Plaid required)
      </p>
      <p className="mt-1 text-xs text-[color:var(--mwm-text-secondary)]">
        Download a CSV from Schwab, Fidelity, or Vanguard and upload it below. Column names are
        auto-detected.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {CUSTODIAN_IMPORT_GUIDES.map((guide) => (
          <button
            key={guide.id}
            type="button"
            onClick={() => setOpenId(guide.id === openId ? null : guide.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              openId === guide.id
                ? 'bg-[color:var(--mwm-navy)] text-white'
                : 'border border-[color:var(--mwm-border)] bg-white text-[color:var(--mwm-navy)] hover:border-[color:var(--mwm-navy)]'
            }`}
          >
            {guide.name}
          </button>
        ))}
      </div>

      {openId ? (
        <div className="mt-4 rounded-lg border border-[color:var(--mwm-border)] bg-white p-4">
          {CUSTODIAN_IMPORT_GUIDES.filter((g) => g.id === openId).map((guide) => (
            <div key={guide.id}>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-[color:var(--mwm-text-secondary)]">
                {guide.exportSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {guide.tips.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-[color:var(--mwm-border)] pt-3">
                  {guide.tips.map((tip) => (
                    <li key={tip} className="text-xs text-[color:var(--mwm-text-secondary)]">
                      Tip: {tip}
                    </li>
                  ))}
                </ul>
              ) : null}
              {guide.templateHref ? (
                <p className="mt-3 text-xs">
                  <a
                    href={guide.templateHref}
                    download
                    className="font-medium text-[color:var(--mwm-navy)] underline-offset-2 hover:underline"
                  >
                    Download sample positions CSV
                  </a>{' '}
                  — column layout reference if your export looks different.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
