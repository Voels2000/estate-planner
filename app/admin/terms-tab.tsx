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
  const [version, setVersion]   = useState(initialVersion)
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)

  function updateSection(idx: number, field: keyof Section, value: string) {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    setSuccess(null)
  }

  function addSection() {
    setSections(prev => [...prev, { title: `${prev.length + 1}. New Section`, body: '' }])
    setExpandedIdx(sections.length)
    setSuccess(null)
  }

  function removeSection(idx: number) {
    if (!confirm('Remove this section?')) return
    setSections(prev => prev.filter((_, i) => i !== idx))
    setSuccess(null)
  }

  function moveSection(idx: number, direction: 'up' | 'down') {
    const newSections = [...sections]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= newSections.length) return;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]]
    setSections(newSections)
    setSuccess(null)
  }

  async function handleSave() {
    if (!version.trim()) {
      setError('Version is required.')
      return
    }
    if (sections.some(s => !s.title.trim() || !s.body.trim())) {
      setError('All sections must have a title and body.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res  = await fetch('/api/admin/terms/update', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ version, sections }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to save.')
      } else {
        setSuccess(
          `Terms saved. Version set to ${version}. ${data.users_re_gated ? 'All users with a prior version will be re-gated on next login.' : ''}`
        )
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Terms & Conditions</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Edit content and version. Saving will re-gate all users who accepted a prior version.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg
                     hover:bg-neutral-800 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? 'Saving...' : '💾 Save & Publish'}
        </button>
      </div>

      {/* Feedback */}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">✅ {success}</div>}

      {/* Version */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Version string
        </label>
        <p className="text-xs text-neutral-400 mb-2">
          Use a date format e.g. 2026-04-01. Changing this re-gates all existing users.
        </p>
        <input
          type="text"
          value={version}
          onChange={e => { setVersion(e.target.value); setSuccess(null) }}
          className="w-full max-w-xs border border-neutral-200 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-neutral-900"
          placeholder="e.g. 2026-04-01"
        />
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section, idx) => (
          <div
            key={idx}
            className="bg-white border border-neutral-200 rounded-xl overflow-hidden"
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between px-5 py-3 cursor-pointer
                         hover:bg-neutral-50 select-none"
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <p className="text-sm font-medium text-neutral-800 truncate flex-1">
                {section.title || 'Untitled Section'}
              </p>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); moveSection(idx, 'up') }}
                  disabled={idx === 0}
                  className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30 px-1"
                >▲</button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); moveSection(idx, 'down') }}
                  disabled={idx === sections.length - 1}
                  className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30 px-1"
                >▼</button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeSection(idx) }}
                  className="text-red-400 hover:text-red-600 px-1 text-sm"
                >✕</button>
                <span className="text-neutral-400 text-xs">
                  {expandedIdx === idx ? '▾' : '▸'}
                </span>
              </div>
            </div>

            {/* Section body */}
            {expandedIdx === idx && (
              <div className="px-5 pb-5 border-t border-neutral-100 pt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Section title
                  </label>
                  <input
                    type="text"
                    value={section.title}
                    onChange={e => updateSection(idx, 'title', e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Section body
                  </label>
                  <textarea
                    value={section.body}
                    onChange={e => updateSection(idx, 'body', e.target.value)}
                    rows={6}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-y"
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    {section.body.length} characters
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add section */}
      <button
        type="button"
        onClick={addSection}
        className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl
                   text-sm text-neutral-400 hover:border-neutral-400 hover:text-neutral-600
                   transition-colors"
      >
        + Add Section
      </button>

    </div>
  )
}
