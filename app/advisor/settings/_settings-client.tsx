'use client'

import { useEffect, useState } from 'react'

export interface SettingsClientProps {
  initialProfile: {
    full_name: string | null
    email: string | null
    firm_name: string | null
    phone: string | null
  }
}

const inputClassName =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-50'

export default function SettingsClient({ initialProfile }: SettingsClientProps) {
  const [baseline, setBaseline] = useState(initialProfile)
  const [fullName, setFullName] = useState(initialProfile.full_name ?? '')
  const [firmName, setFirmName] = useState(initialProfile.firm_name ?? '')
  const [phone, setPhone] = useState(initialProfile.phone ?? '')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!saveSuccess) return
    const t = setTimeout(() => setSaveSuccess(null), 3000)
    return () => clearTimeout(t)
  }, [saveSuccess])

  async function handleSave() {
    setSaveError(null)
    setSaveSuccess(null)

    const payload: Record<string, string | null> = {}
    const trimmedFullName = fullName.trim()
    const trimmedFirmName = firmName.trim()
    const trimmedPhone = phone.trim()

    if (trimmedFullName !== (baseline.full_name ?? '').trim()) {
      payload.full_name = trimmedFullName || null
    }
    if (trimmedFirmName !== (baseline.firm_name ?? '').trim()) {
      payload.firm_name = trimmedFirmName || null
    }
    if (trimmedPhone !== (baseline.phone ?? '').trim()) {
      payload.phone = trimmedPhone || null
    }

    if (Object.keys(payload).length === 0) {
      setSaveSuccess('No changes to save.')
      return
    }

    setSaveLoading(true)
    try {
      const res = await fetch('/api/advisor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        profile?: SettingsClientProps['initialProfile']
      }
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save profile.')
        return
      }
      if (data.profile) {
        const next = {
          full_name: data.profile.full_name,
          email: data.profile.email ?? baseline.email,
          firm_name: data.profile.firm_name,
          phone: data.profile.phone,
        }
        setBaseline(next)
        setFullName(next.full_name ?? '')
        setFirmName(next.firm_name ?? '')
        setPhone(next.phone ?? '')
      }
      setSaveSuccess('Saved.')
    } catch {
      setSaveError('Something went wrong. Please try again.')
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <a
          href="/advisor"
          className="text-sm font-medium text-[color:var(--mwm-navy)] hover:underline"
        >
          ← Advisor Portal
        </a>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--mwm-navy)]">Profile Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Update how your name and firm appear on PDF exports and meeting briefs.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
          Advisor profile
        </h2>
        <div className="space-y-5 max-w-md">
          <div>
            <label htmlFor="advisor-full-name" className="block text-sm font-medium text-neutral-700 mb-1">
              Display name
            </label>
            <input
              id="advisor-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              disabled={saveLoading}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="advisor-firm-name" className="block text-sm font-medium text-neutral-700 mb-1">
              Firm name
            </label>
            <input
              id="advisor-firm-name"
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="My Wealth Maps"
              maxLength={100}
              disabled={saveLoading}
              className={inputClassName}
            />
            <p className="mt-1 text-xs text-neutral-500">Used on PDF exports and meeting briefs.</p>
          </div>

          <div>
            <label htmlFor="advisor-phone" className="block text-sm font-medium text-neutral-700 mb-1">
              Phone
            </label>
            <input
              id="advisor-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              maxLength={30}
              disabled={saveLoading}
              className={inputClassName}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-neutral-700 mb-1">Email</span>
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
              {baseline.email ?? '—'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Sign-in email — change via account settings elsewhere.</p>
          </div>

          <div>
            <span className="block text-sm font-medium text-neutral-400 mb-1">Firm logo</span>
            <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-400">
              Logo upload coming soon
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveLoading}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {saveLoading ? 'Saving…' : 'Save changes'}
            </button>
            {saveSuccess && <span className="text-sm text-green-700">{saveSuccess}</span>}
            {saveError && <span className="text-sm text-red-600">{saveError}</span>}
          </div>
        </div>
      </section>
    </div>
  )
}
