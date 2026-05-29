'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { formControlClass, formLabelClass } from '@/components/ui/form'

type AssetTypeOption = { value: string; label: string }

type Props = {
  open: boolean
  onClose: () => void
  assetTypes: AssetTypeOption[]
  person1Name: string
  person2Name: string
  hasSpouse: boolean
}

export function QuickAddAssetModal({
  open,
  onClose,
  assetTypes,
  person1Name,
  person2Name,
  hasSpouse,
}: Props) {
  const router = useRouter()
  const sortedTypes = [...assetTypes].sort((a, b) => a.label.localeCompare(b.label))
  const [name, setName] = useState('')
  const [type, setType] = useState(sortedTypes[0]?.value ?? '')
  const [value, setValue] = useState('')
  const [owner, setOwner] = useState('person1')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !type || !value) {
      setError('Name, type, and value are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          value: Number(value),
          owner,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save asset')
      }
      setName('')
      setValue('')
      onClose()
      // Same afterHouseholdWrite → recompute chain as /assets; first modal-triggered refresh path.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save asset')
      setSubmitting(false)
    }
  }

  const ownerOptions = [
    { value: 'person1', label: person1Name || 'Person 1' },
    ...(hasSpouse ? [{ value: 'person2', label: person2Name || 'Person 2' }] : []),
    ...(hasSpouse ? [{ value: 'joint', label: 'Joint' }] : []),
  ]

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-asset-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="quick-add-asset-title"
              className="font-[family-name:var(--font-display)] text-lg text-[color:var(--mwm-navy)]"
            >
              Add your first asset
            </h2>
            <p className="mt-1 text-xs text-[color:var(--mwm-text-muted)]">
              One account is enough to see your net worth on the dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className={`${formLabelClass} mb-1 block`}>Account name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={formControlClass}
              placeholder="Chase checking"
              autoFocus
            />
          </div>
          <div>
            <label className={`${formLabelClass} mb-1 block`}>Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={formControlClass}
            >
              {sortedTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`${formLabelClass} mb-1 block`}>Estimated value ($)</label>
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={formControlClass}
              placeholder="250000"
            />
          </div>
          <div>
            <label className={`${formLabelClass} mb-1 block`}>Ownership</label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={formControlClass}
            >
              {ownerOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={submitting} className="w-full">
              {submitting ? 'Saving…' : 'Add asset'}
            </Button>
            <Link
              href="/assets"
              className="text-center text-xs text-[color:var(--mwm-navy)] underline underline-offset-2"
              onClick={onClose}
            >
              Manage all assets →
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
