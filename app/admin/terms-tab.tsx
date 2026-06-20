'use client'

import { useState } from 'react'

type Section = {
  title: string
  body:  string
}

type Props = {
  initialVersion:  string
  initialSections: Section[]
}

export default function TermsTab({ initialVersion, initialSections }: Props) {
  const [regating, setRegating]     = useState(false)
  const [success, setSuccess]         = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)

  async function handleRegate() {
    const confirmed = confirm(
      `Re-gate all users who have not accepted ToS version ${initialVersion}? ` +
      'They will be prompted to accept on next login.'
    )
    if (!confirmed) return

    setRegating(true)
    setError(null)
    setSuccess(null)

    try {
      const res  = await fetch('/api/admin/terms/regate', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to re-gate users.')
      } else {
        setSuccess(
          `Users with a prior version will be re-gated on next login (canonical version ${data.version}).`
        )
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setRegating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Terms of Service</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Canonical source:{' '}
            <code className="text-xs">lib/legal/terms-of-service-sections.ts</code>.
            Edit that file, bump <code className="text-xs">TERMS_OF_SERVICE_VERSION</code>, deploy,
            then re-gate users below. Public <code className="text-xs">/terms</code> reads from code only —
            not <code className="text-xs">app_config</code>.
          </p>
        </div>
        <button
          onClick={handleRegate}
          disabled={regating}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg
                     hover:bg-neutral-800 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {regating ? 'Re-gating…' : 'Re-gate users'}
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">✅ {success}</div>}

      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <p className="text-sm font-medium text-neutral-700">Deployed version</p>
        <p className="text-lg font-mono text-neutral-900 mt-1">{initialVersion}</p>
        <p className="text-xs text-neutral-400 mt-2">
          {initialSections.length} sections · read-only preview from deployed code
        </p>
      </div>

      <div className="space-y-3">
        {initialSections.map((section, idx) => (
          <div
            key={idx}
            className="bg-white border border-neutral-200 rounded-xl overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-5 py-3 cursor-pointer
                         hover:bg-neutral-50 select-none"
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <p className="text-sm font-medium text-neutral-800 truncate flex-1">
                {section.title}
              </p>
              <span className="text-neutral-400 text-xs ml-4 shrink-0">
                {expandedIdx === idx ? '▾' : '▸'}
              </span>
            </div>

            {expandedIdx === idx && (
              <div className="px-5 pb-5 border-t border-neutral-100 pt-4">
                <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">
                  {section.body}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
