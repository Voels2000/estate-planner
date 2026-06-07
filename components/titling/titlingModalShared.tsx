'use client'

import type { ReactNode } from 'react'
import { TITLE_TYPES } from '@/lib/titling/titlingDisplayHelpers'

export const LIQUIDITY_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'liquid', label: 'Liquid (immediate access)' },
  { value: 'semi_liquid', label: 'Semi-liquid (30-90 days)' },
  { value: 'illiquid', label: 'Illiquid (real estate, private)' },
  { value: 'long', label: 'Long-term locked (pension, annuity)' },
]

export const RELATIONSHIPS = [
  'Spouse', 'Child', 'Parent', 'Sibling', 'Grandchild',
  'Trust', 'Charity', 'Estate', 'Other',
]

export const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

export function getTitleDescription(titleType: string): string {
  const descriptions: Record<string, string> = {
    sole: 'Owned by one person. Goes through probate unless TOD/beneficiary is named.',
    joint_wros: 'Co-owners each hold an undivided interest. Survivor inherits automatically — no probate.',
    tenants_in_common: 'Each owner holds a specific share. Their share passes through their estate/will.',
    community_property: 'Property acquired during marriage owned equally by both spouses.',
    tod_pod: 'Transfer/Payable on Death — passes directly to named beneficiary, bypasses probate.',
    trust_owned: 'Held in a trust. Distribution governed by trust terms — typically avoids probate.',
    corporate: 'Owned by a business entity (LLC, corporation, partnership).',
  }
  return descriptions[titleType] ?? ''
}

export function ModalShell({
  title,
  onClose,
  wide,
  children,
}: {
  title: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200 ${
          wide ? 'max-w-4xl' : 'max-w-md'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function ModalButtons({ onClose, isSubmitting, isEdit }: { onClose: () => void; isSubmitting: boolean; isEdit: boolean }) {
  return (
    <div className="flex gap-3 pt-2 pb-1">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex-1 rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--mwm-navy-light)] disabled:opacity-50 transition"
      >
        {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add'}
      </button>
    </div>
  )
}

export { TITLE_TYPES }
