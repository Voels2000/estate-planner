'use client'

import Link from 'next/link'
import { useState } from 'react'
import { picklistValueForFullName } from '@/lib/titling/beneficiaryPicklist'
import type { BeneficiaryPicklistOption } from '@/lib/titling/titlingEntityTypes'
import type { Beneficiary, TitlingKind } from '@/lib/titling/types'
import {
  inputClass,
  ModalButtons,
  ModalShell,
  RELATIONSHIPS,
} from '@/components/titling/titlingModalShared'

export default function BeneficiaryModal({
  kind,
  id,
  name,
  existing,
  defaultType,
  allBeneficiariesForItem,
  picklistOptions,
  householdPeopleEmpty,
  onClose,
  onSave,
}: {
  kind: TitlingKind
  id: string
  name: string
  existing: Beneficiary | null
  defaultType: 'primary' | 'contingent'
  allBeneficiariesForItem: Beneficiary[]
  picklistOptions: BeneficiaryPicklistOption[]
  householdPeopleEmpty: boolean
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [beneficiaryType, setBeneficiaryType] = useState<'primary' | 'contingent'>(
    existing?.beneficiary_type ?? defaultType,
  )
  const [pickerValue, setPickerValue] = useState(() =>
    existing ? picklistValueForFullName(existing.full_name, picklistOptions) : '',
  )
  const [manualName, setManualName] = useState(existing?.full_name ?? '')
  const [manualRelationship, setManualRelationship] = useState(existing?.relationship || 'Other')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [isGstSkip, setIsGstSkip] = useState(existing?.is_gst_skip ?? false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calcRemaining = (type: 'primary' | 'contingent') => {
    const allocated = allBeneficiariesForItem
      .filter((b) => b.beneficiary_type === type)
      .reduce((s, b) => s + Number(b.allocation_pct), 0)
    return Math.max(0, 100 - allocated)
  }

  const [allocationPct, setAllocationPct] = useState(() => {
    if (existing?.allocation_pct != null) return existing.allocation_pct.toString()
    return String(calcRemaining(existing?.beneficiary_type ?? defaultType))
  })

  function applyPickerChoice(next: string) {
    setPickerValue(next)
    if (next === '' || next === '__manual__') {
      if (next === '__manual__') {
        setManualName((m) => m || existing?.full_name || '')
      }
      return
    }
    const opt = picklistOptions.find((o) => o.value === next)
    if (opt) {
      setManualName(opt.fullName)
      setManualRelationship(opt.relationship)
      setIsGstSkip(opt.isGst)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const pct = parseFloat(allocationPct)
    const remaining = calcRemaining(beneficiaryType)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Allocation must be between 1 and 100.')
      setIsSubmitting(false)
      return
    }
    if (pct > remaining + 0.01) {
      setError(`Only ${remaining.toFixed(0)}% remaining for ${beneficiaryType} beneficiaries.`)
      setIsSubmitting(false)
      return
    }

    let fullNameOut: string
    let relationshipOut: string | null

    if (pickerValue === '__manual__') {
      const t = manualName.trim()
      if (!t) {
        setError('Enter a full name or pick from the list.')
        setIsSubmitting(false)
        return
      }
      fullNameOut = t
      relationshipOut = manualRelationship.trim() || null
    } else if (pickerValue) {
      const opt = picklistOptions.find((o) => o.value === pickerValue)
      if (!opt) {
        setError('Invalid beneficiary selection.')
        setIsSubmitting(false)
        return
      }
      fullNameOut = opt.fullName
      relationshipOut = opt.relationship || null
    } else {
      setError('Choose a beneficiary or + Add manually…')
      setIsSubmitting(false)
      return
    }

    try {
      const body = {
        beneficiary_type: beneficiaryType,
        full_name: fullNameOut,
        relationship: relationshipOut,
        email: email.trim() || null,
        phone: phone.trim() || null,
        allocation_pct: pct,
        is_gst_skip: isGstSkip,
        asset_id: kind === 'asset' ? id : null,
        real_estate_id: kind === 're' ? id : null,
        insurance_policy_id: kind === 'insurance' ? id : null,
        business_id: kind === 'business' ? id : null,
      }
      const res = await fetch('/api/consumer/asset-beneficiaries', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing ? { id: existing.id, ...body } : body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save beneficiary')
      }
      await onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  const remaining = calcRemaining(beneficiaryType)
  const alreadyAllocated = 100 - remaining
  const showManualFields = pickerValue === '__manual__'

  return (
    <ModalShell title={`${existing ? 'Edit' : 'Add'} Beneficiary — ${name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
          <select
            value={beneficiaryType}
            onChange={(e) => {
              const v = e.target.value as 'primary' | 'contingent'
              setBeneficiaryType(v)
              setAllocationPct(String(calcRemaining(v)))
            }}
            className={inputClass}
          >
            <option value="primary">Primary</option>
            <option value="contingent">Contingent</option>
          </select>
        </div>

        {householdPeopleEmpty && (
          <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
            <p>Add family members on the My Family page first for the best results.</p>
            <Link href="/my-family" className="mt-1 inline-block font-medium text-[color:var(--mwm-navy)] hover:underline">
              Go to My Family →
            </Link>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Beneficiary</label>
          <select
            value={pickerValue}
            onChange={(e) => applyPickerChoice(e.target.value)}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {picklistOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="__manual__">+ Add manually…</option>
          </select>
        </div>

        {showManualFields && (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Jane Smith or trust / charity name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Relationship</label>
              <select
                value={manualRelationship}
                onChange={(e) => setManualRelationship(e.target.value)}
                className={inputClass}
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="gst_skip_modal"
            checked={isGstSkip}
            onChange={(e) => setIsGstSkip(e.target.checked)}
            className="rounded border-neutral-300"
          />
          <label htmlFor="gst_skip_modal" className="text-sm text-neutral-700">
            GST Skip Person (grandchild or skip generation)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Allocation (%)</label>
          <input
            type="number"
            required
            min="1"
            max={remaining}
            step="0.01"
            value={allocationPct}
            onChange={(e) => setAllocationPct(e.target.value)}
            className={inputClass}
            placeholder={remaining.toString()}
          />
          <p className="mt-1 text-xs text-neutral-400">
            {alreadyAllocated > 0
              ? `${alreadyAllocated.toFixed(0)}% already allocated — ${remaining.toFixed(0)}% remaining`
              : 'All beneficiaries of this type should total 100%.'}
          </p>
        </div>
        <ModalButtons onClose={onClose} isSubmitting={isSubmitting} isEdit={!!existing} />
      </form>
    </ModalShell>
  )
}
