'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { formControlClass, formLabelClass } from '@/components/ui/form'
import type { ProfileSavePayload } from '@/lib/profile/buildHouseholdPayload'

export type ProfileInlineField = {
  key: string
  label: string
  type: 'number' | 'select'
  placeholder?: string
  min?: number
  max?: number
  options?: { value: string; label: string }[]
  /** Maps field value into a partial ProfileSavePayload patch */
  patch: (value: string) => Partial<ProfileSavePayload>
}

type Props = {
  title: string
  description: string
  fields: ProfileInlineField[]
  basePayload: ProfileSavePayload
}

export function ProfileIncompleteInlinePrompt({
  title,
  description,
  fields,
  basePayload,
}: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (fields.length === 0) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    for (const field of fields) {
      if (!values[field.key]?.trim()) {
        setError(`${field.label} is required`)
        return
      }
    }

    setSaving(true)
    try {
      const patch = fields.reduce<Partial<ProfileSavePayload>>(
        (acc, field) => ({ ...acc, ...field.patch(values[field.key] ?? '') }),
        {},
      )
      const res = await fetch('/api/consumer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, ...patch }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
      <p className="text-sm font-semibold text-amber-900">{title}</p>
      <p className="mt-1 text-xs text-amber-800">{description}</p>
      <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key}>
              <label className={`${formLabelClass} mb-1 block text-xs`}>{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={values[field.key] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className={formControlClass}
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={values[field.key] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className={formControlClass}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save and continue'}
        </Button>
      </form>
    </div>
  )
}
