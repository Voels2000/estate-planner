'use client'

import { useState } from 'react'
import type { AnyTitling, TitlingKind } from '@/lib/titling/types'
import type { Asset, TitlingEntityRow } from '@/lib/titling/titlingEntityTypes'
import {
  getTitleDescription,
  inputClass,
  LIQUIDITY_OPTIONS,
  ModalButtons,
  ModalShell,
  TITLE_TYPES,
} from '@/components/titling/titlingModalShared'

export default function TitlingModal({
  kind, id, name, existing, asset, entityRow, titlingOptions, onClose, onSave,
}: {
  kind: TitlingKind
  id: string
  name: string
  existing: AnyTitling | null
  asset: Asset | null
  entityRow: TitlingEntityRow | null
  titlingOptions: { value: string; label: string }[]
  onClose: () => void
  onSave: () => void
}) {
  const [titleType, setTitleType] = useState(existing?.title_type ?? 'sole')
  const [assetTitling, setAssetTitling] = useState(asset?.titling ?? '')
  const [ownerTitling, setOwnerTitling] = useState(
    entityRow ? (entityRow.titling ?? '') : '',
  )
  const [liquidity, setLiquidity] = useState(
    (kind === 'asset' ? asset?.liquidity : entityRow?.liquidity) ?? '',
  )
  const [costBasis, setCostBasis] = useState(() => {
    const cb = kind === 'asset' ? asset?.cost_basis : entityRow?.cost_basis
    return cb == null ? '' : String(cb)
  })
  const [basisDate, setBasisDate] = useState(
    (kind === 'asset' ? asset?.basis_date : entityRow?.basis_date) ?? '',
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const entityRef =
        kind === 'asset' ? { asset_id: id }
        : kind === 're' ? { real_estate_id: id }
          : kind === 'insurance' ? { insurance_policy_id: id }
            : { business_id: id }

      const res = await fetch('/api/consumer/entity-titling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entityRef,
          titling_row_id: existing?.id ?? null,
          title_type: titleType,
          notes: notes.trim() || null,
          titling: (kind === 'asset' ? assetTitling : ownerTitling) || null,
          liquidity: liquidity || null,
          cost_basis: costBasis.trim() === '' ? null : costBasis,
          basis_date: basisDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save titling')
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell title={`Set Title — ${name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
        {kind === 'asset' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title Type</label>
              <select value={titleType} onChange={e => setTitleType(e.target.value)} className={inputClass}>
                {TITLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-neutral-400">{getTitleDescription(titleType)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Titling</label>
              <select
                value={assetTitling}
                onChange={e => setAssetTitling(e.target.value)}
                className={inputClass}
              >
                {titlingOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Liquidity</label>
              <select
                value={liquidity}
                onChange={e => setLiquidity(e.target.value)}
                className={inputClass}
              >
                {LIQUIDITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Cost Basis</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costBasis}
                  onChange={e => setCostBasis(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Basis Date</label>
                <input
                  type="date"
                  value={basisDate}
                  onChange={e => setBasisDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Owner</label>
              <select
                value={ownerTitling}
                onChange={e => setOwnerTitling(e.target.value)}
                className={inputClass}
              >
                {titlingOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title Type</label>
              <select value={titleType} onChange={e => setTitleType(e.target.value)} className={inputClass}>
                {TITLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-neutral-400">{getTitleDescription(titleType)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Liquidity</label>
              <select
                value={liquidity}
                onChange={e => setLiquidity(e.target.value)}
                className={inputClass}
              >
                {LIQUIDITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Cost Basis</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costBasis}
                  onChange={e => setCostBasis(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Basis Date</label>
                <input
                  type="date"
                  value={basisDate}
                  onChange={e => setBasisDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Notes <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={inputClass}
            placeholder="e.g. Trust name, TIC split percentage"
          />
        </div>
        <ModalButtons onClose={onClose} isSubmitting={isSubmitting} isEdit={!!existing} />
      </form>
    </ModalShell>
  )
}
