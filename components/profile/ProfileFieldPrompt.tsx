'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { formControlClass, formLabelClass } from '@/components/ui/form'
import type { ProfileSavePayload } from '@/lib/profile/buildHouseholdPayload'
import type { ProfileFieldDef } from '@/lib/profile/profileFieldPromptDefs'

type Props = {
  promptKey: string
  title: string
  description: string
  fields: ProfileFieldDef[]
  householdId: string
  onSaved?: () => void
  className?: string
}

/**
 * Shared inline prompt for deferred profile fields on /social-security and /scenarios.
 * Sends a partial PATCH; API merges with existing household (see mergeProfilePatch).
 */
export function ProfileFieldPrompt({
  promptKey,
  title,
  description,
  fields,
  householdId,
  onSaved,
  className = '',
}: Props) {
  const router = useRouter()
  const [localState, setLocalState] = useState<Record<string, string>>({})
  const [dismissed, setDismissed] = useState(false)
  const [savedHidden, setSavedHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(`mwm_prompt_dismissed_${promptKey}`) === '1')
    } catch {
      setDismissed(false)
    }
  }, [promptKey])

  if (fields.length === 0 || dismissed || savedHidden) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    for (const field of fields) {
      if (!localState[field.name]?.trim()) {
        setError(`${field.label} is required`)
        return
      }
    }
    if (localState.deduction_mode === 'custom' && !localState.custom_deduction_amount?.trim()) {
      setError('Custom annual deduction amount is required')
      return
    }

    setSaving(true)
    try {
      const patch: Partial<ProfileSavePayload> = { householdId }
      for (const field of fields) {
        const raw = localState[field.name] ?? ''
        ;(patch as Record<string, string>)[field.payloadKey as string] = raw
      }
      if (localState.deduction_mode === 'custom') {
        patch.customDeductionAmount = localState.custom_deduction_amount ?? ''
      }

      const res = await fetch('/api/consumer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }

      setSavedHidden(true)
      onSaved?.()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  function handleDismiss() {
    try {
      sessionStorage.setItem(`mwm_prompt_dismissed_${promptKey}`, '1')
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  return (
    <div
      className={`mb-6 rounded-lg border border-[#C9A84C]/40 border-l-4 border-l-[#C9A84C] bg-amber-50/30 p-4 ${className}`}
    >
      <p className="text-sm font-semibold text-[#0F1B3C]">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name}>
              <label className={`${formLabelClass} mb-1 block text-xs`}>{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={localState[field.name] ?? ''}
                  onChange={(e) =>
                    setLocalState((prev) => ({ ...prev, [field.name]: e.target.value }))
                  }
                  className={formControlClass}
                  disabled={saving}
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
                  value={localState[field.name] ?? ''}
                  onChange={(e) =>
                    setLocalState((prev) => ({ ...prev, [field.name]: e.target.value }))
                  }
                  className={formControlClass}
                  placeholder={field.placeholder}
                  disabled={saving}
                />
              )}
              {field.helpText && (
                <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>
              )}
            </div>
          ))}
          {localState.deduction_mode === 'custom' && (
            <div>
              <label className={`${formLabelClass} mb-1 block text-xs`}>
                Custom annual deduction amount
              </label>
              <input
                type="number"
                min={0}
                value={localState.custom_deduction_amount ?? ''}
                onChange={(e) =>
                  setLocalState((prev) => ({
                    ...prev,
                    custom_deduction_amount: e.target.value,
                  }))
                }
                className={formControlClass}
                placeholder="e.g. 45000"
                disabled={saving}
              />
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {!saving && (
            <button
              type="button"
              onClick={handleDismiss}
              className="cursor-pointer text-xs text-gray-400 underline"
            >
              Remind me later
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
