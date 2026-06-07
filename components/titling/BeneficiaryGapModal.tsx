'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  contingentEvenSplitPercents,
  householdChildrenForContingentSplit,
  normalizeNameKey,
  picklistValueForFullName,
  suggestPrimaryBeneficiary,
} from '@/lib/titling/beneficiaryPicklist'
import type {
  BeneficiaryPicklistOption,
  GapItem,
  HouseholdPersonRow,
} from '@/lib/titling/titlingEntityTypes'
import type { Beneficiary, TitlingKind } from '@/lib/titling/types'
import { inputClass, ModalShell } from '@/components/titling/titlingModalShared'

function gapItemKey(row: GapItem): string {
  return `${row.kind}:${row.id}`
}

type BeneficiaryGapRowState = {
  primaryValue: string
  primaryManual: string
  contingentValue: string
  contingentManual: string
  contingentSplitRows: Array<{
    householdPersonId: string
    pickValue: string
    manual: string
    allocationPct: string
  }> | null
}

/** Merge UI row edits with freshly built defaults so partial state never drops contingent splits or suggested primaries. */
function mergeGapRowForApply(
  fb: BeneficiaryGapRowState,
  cur: BeneficiaryGapRowState | undefined,
): BeneficiaryGapRowState {
  if (!cur) return fb
  const useCurPrimary = cur.primaryValue !== '' || cur.primaryManual.trim() !== ''
  const split =
    cur.contingentSplitRows && cur.contingentSplitRows.length > 0
      ? cur.contingentSplitRows
      : fb.contingentSplitRows
  const useCurContingentSingle =
    !split || split.length === 0
      ? cur.contingentValue !== '' || cur.contingentManual.trim() !== ''
      : false
  return {
    ...fb,
    ...cur,
    primaryValue: useCurPrimary ? cur.primaryValue : fb.primaryValue,
    primaryManual: useCurPrimary ? cur.primaryManual : fb.primaryManual,
    contingentSplitRows: split,
    contingentValue: useCurContingentSingle ? cur.contingentValue : fb.contingentValue,
    contingentManual: useCurContingentSingle ? cur.contingentManual : fb.contingentManual,
  }
}

function buildBeneficiaryGapRowsState(
  items: GapItem[],
  picklistOptions: BeneficiaryPicklistOption[],
  householdPeople: HouseholdPersonRow[],
  hasSpouse: boolean,
  person1LegalName: string | null,
  person2LegalName: string | null,
  descendantsOrdered: HouseholdPersonRow[],
): Record<string, BeneficiaryGapRowState> {
  const childrenForSplit = householdChildrenForContingentSplit(householdPeople)
  const next: Record<string, BeneficiaryGapRowState> = {}
  for (const row of items) {
    const sp = row.needsPrimary
      ? suggestPrimaryBeneficiary({
          owner: row.owner,
          hasSpouse,
          person1LegalName,
          person2LegalName,
          descendantsOrdered,
        })
      : null
    let contingentValue = ''
    let contingentManual = ''
    let contingentSplitRows: BeneficiaryGapRowState['contingentSplitRows'] = null
    if (row.needsContingent) {
      if (childrenForSplit.length >= 1) {
        const splits = contingentEvenSplitPercents(childrenForSplit.length)
        contingentSplitRows = childrenForSplit.map((c, i) => ({
          householdPersonId: c.id,
          pickValue: `hp-row:${c.id}`,
          manual: '',
          allocationPct: splits[i].toFixed(2),
        }))
      } else {
        contingentValue = ''
        contingentManual = ''
      }
    }
    next[gapItemKey(row)] = {
      primaryValue: row.needsPrimary && sp ? picklistValueForFullName(sp, picklistOptions) : '',
      primaryManual: '',
      contingentValue,
      contingentManual,
      contingentSplitRows,
    }
  }
  return next
}

function resolveBeneficiaryFromPick(
  value: string,
  manual: string,
  options: BeneficiaryPicklistOption[],
): { fullName: string; relationship: string; isGst: boolean } | null {
  if (!value) return null
  if (value === '__manual__') {
    const t = manual.trim()
    if (!t) return null
    return { fullName: t, relationship: 'Other', isGst: false }
  }
  const opt = options.find((o) => o.value === value)
  if (!opt) return null
  return { fullName: opt.fullName, relationship: opt.relationship, isGst: opt.isGst }
}

export default function BeneficiaryGapModal({
  items,
  picklistOptions,
  beneficiaries,
  householdPeople,
  hasSpouse,
  person1LegalName,
  person2LegalName,
  descendantsOrdered,
  onClose,
  onApplied,
}: {
  items: GapItem[]
  picklistOptions: BeneficiaryPicklistOption[]
  beneficiaries: Beneficiary[]
  householdPeople: HouseholdPersonRow[]
  hasSpouse: boolean
  person1LegalName: string | null
  person2LegalName: string | null
  descendantsOrdered: HouseholdPersonRow[]
  onClose: () => void
  onApplied: () => Promise<void>
}) {
  const [rows, setRows] = useState<Record<string, BeneficiaryGapRowState>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fallbackRows = useMemo(
    () =>
      buildBeneficiaryGapRowsState(
        items,
        picklistOptions,
        householdPeople,
        hasSpouse,
        person1LegalName,
        person2LegalName,
        descendantsOrdered,
      ),
    [
      items,
      picklistOptions,
      householdPeople,
      hasSpouse,
      person1LegalName,
      person2LegalName,
      descendantsOrdered,
    ],
  )

  useEffect(() => {
    setRows(
      buildBeneficiaryGapRowsState(
        items,
        picklistOptions,
        householdPeople,
        hasSpouse,
        person1LegalName,
        person2LegalName,
        descendantsOrdered,
      ),
    )
  }, [items, hasSpouse, person1LegalName, person2LegalName, descendantsOrdered, picklistOptions, householdPeople])

  function getBensFor(
    working: Beneficiary[],
    kind: TitlingKind,
    itemId: string,
    type: 'primary' | 'contingent',
  ) {
    return working.filter((b) => {
      if (b.beneficiary_type !== type) return false
      if (kind === 'asset') return b.asset_id === itemId
      if (kind === 're') return b.real_estate_id === itemId
      if (kind === 'insurance') return b.insurance_policy_id === itemId
      return b.business_id === itemId
    })
  }

  function remainingPct(working: Beneficiary[], kind: TitlingKind, itemId: string, type: 'primary' | 'contingent') {
    const allocated = getBensFor(working, kind, itemId, type).reduce((s, b) => s + Number(b.allocation_pct), 0)
    return Math.max(0, 100 - allocated)
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const working = [...beneficiaries]
      const bulkItems: Record<string, unknown>[] = []
      const applyErrors: string[] = []

      function entityRefForRow(row: GapItem) {
        return {
          asset_id: row.kind === 'asset' ? row.id : null,
          real_estate_id: row.kind === 're' ? row.id : null,
          insurance_policy_id: row.kind === 'insurance' ? row.id : null,
          business_id: row.kind === 'business' ? row.id : null,
        }
      }

      for (const row of items) {
        const key = gapItemKey(row)
        const fb = fallbackRows[key]
        if (!fb) continue
        const st = mergeGapRowForApply(fb, rows[key])

        if (row.needsPrimary) {
          const resolved = resolveBeneficiaryFromPick(st.primaryValue, st.primaryManual, picklistOptions)
          if (resolved) {
            const rem = remainingPct(working, row.kind, row.id, 'primary')
            if (rem > 0.01) {
              bulkItems.push({
                ...entityRefForRow(row),
                beneficiary_type: 'primary',
                full_name: resolved.fullName,
                relationship: resolved.relationship,
                email: null,
                phone: null,
                allocation_pct: rem,
                is_gst_skip: resolved.isGst,
              })
              working.push({
                id: `temp-${row.id}-p`,
                asset_id: row.kind === 'asset' ? row.id : null,
                real_estate_id: row.kind === 're' ? row.id : null,
                insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                business_id: row.kind === 'business' ? row.id : null,
                beneficiary_type: 'primary',
                full_name: resolved.fullName,
                relationship: resolved.relationship,
                email: null,
                phone: null,
                allocation_pct: rem,
                is_gst_skip: resolved.isGst,
              })
            }
          }
        }

        if (row.needsContingent) {
          if (st.contingentSplitRows && st.contingentSplitRows.length > 0) {
            for (const cr of st.contingentSplitRows) {
              const resolved = resolveBeneficiaryFromPick(cr.pickValue, cr.manual, picklistOptions)
              if (!resolved) continue
              const already = getBensFor(working, row.kind, row.id, 'contingent').some(
                (b) => normalizeNameKey(b.full_name) === normalizeNameKey(resolved.fullName),
              )
              if (already) continue
              const pct = parseFloat(cr.allocationPct)
              if (!Number.isFinite(pct) || pct <= 0) continue
              bulkItems.push({
                ...entityRefForRow(row),
                beneficiary_type: 'contingent',
                full_name: resolved.fullName,
                relationship: resolved.relationship,
                email: null,
                phone: null,
                allocation_pct: pct,
                is_gst_skip: resolved.isGst,
              })
              working.push({
                id: `temp-${row.id}-c-${cr.householdPersonId}`,
                asset_id: row.kind === 'asset' ? row.id : null,
                real_estate_id: row.kind === 're' ? row.id : null,
                insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                business_id: row.kind === 'business' ? row.id : null,
                beneficiary_type: 'contingent',
                full_name: resolved.fullName,
                relationship: resolved.relationship,
                email: null,
                phone: null,
                allocation_pct: pct,
                is_gst_skip: resolved.isGst,
              })
            }
          } else {
            const resolved = resolveBeneficiaryFromPick(st.contingentValue, st.contingentManual, picklistOptions)
            if (resolved) {
              const rem = remainingPct(working, row.kind, row.id, 'contingent')
              if (rem > 0.01) {
                bulkItems.push({
                  ...entityRefForRow(row),
                  beneficiary_type: 'contingent',
                  full_name: resolved.fullName,
                  relationship: resolved.relationship,
                  email: null,
                  phone: null,
                  allocation_pct: rem,
                  is_gst_skip: resolved.isGst,
                })
                working.push({
                  id: `temp-${row.id}-c`,
                  asset_id: row.kind === 'asset' ? row.id : null,
                  real_estate_id: row.kind === 're' ? row.id : null,
                  insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                  business_id: row.kind === 'business' ? row.id : null,
                  beneficiary_type: 'contingent',
                  full_name: resolved.fullName,
                  relationship: resolved.relationship,
                  email: null,
                  phone: null,
                  allocation_pct: rem,
                  is_gst_skip: resolved.isGst,
                })
              }
            }
          }
        }
      }

      if (bulkItems.length > 0) {
        const res = await fetch('/api/consumer/asset-beneficiaries/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: bulkItems }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Failed to apply defaults')
          return
        }
        if (data.errors?.length) {
          applyErrors.push(...data.errors)
        }
        if (data.appliedCount > 0) {
          await onApplied()
          return
        }
      }

      if (applyErrors.length > 0) {
        setError(`No defaults were applied. ${applyErrors.slice(0, 3).join(' | ')}`)
      } else {
        setError('No defaults were applied. There may be no missing beneficiary assignments left to fill.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell title="Review & Apply Defaults" onClose={onClose} wide>
      <form onSubmit={handleApply} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}
        <p className="text-xs text-neutral-600">
          Only missing primary or contingent assignments are saved. Existing designations are never overwritten.
        </p>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Asset / policy</th>
                <th className="px-3 py-2">Primary</th>
                <th className="px-3 py-2">Contingent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((row) => {
                const k = gapItemKey(row)
                const st =
                  rows[k] ??
                  fallbackRows[k] ?? {
                    primaryValue: '',
                    primaryManual: '',
                    contingentValue: '',
                    contingentManual: '',
                    contingentSplitRows: null,
                  }
                const primaries = beneficiaries.filter((b) => {
                  if (b.beneficiary_type !== 'primary') return false
                  if (row.kind === 'asset') return b.asset_id === row.id
                  if (row.kind === 're') return b.real_estate_id === row.id
                  if (row.kind === 'insurance') return b.insurance_policy_id === row.id
                  return b.business_id === row.id
                })
                const contingents = beneficiaries.filter((b) => {
                  if (b.beneficiary_type !== 'contingent') return false
                  if (row.kind === 'asset') return b.asset_id === row.id
                  if (row.kind === 're') return b.real_estate_id === row.id
                  if (row.kind === 'insurance') return b.insurance_policy_id === row.id
                  return b.business_id === row.id
                })
                return (
                  <tr key={k} className="align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-neutral-900">{row.name}</p>
                      <p className="text-xs text-neutral-400 capitalize">{row.subtitle}</p>
                    </td>
                    <td className="px-3 py-2 min-w-[12rem]">
                      {row.needsPrimary ? (
                        <div className="space-y-1">
                          <select
                            value={st.primaryValue}
                            onChange={(e) =>
                              setRows((prev) => {
                                const cur = prev[k] ?? fallbackRows[k]!
                                return { ...prev, [k]: { ...cur, primaryValue: e.target.value } }
                              })
                            }
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
                          {st.primaryValue === '__manual__' && (
                            <input
                              type="text"
                              value={st.primaryManual}
                              onChange={(e) =>
                                setRows((prev) => {
                                  const cur = prev[k] ?? fallbackRows[k]!
                                  return { ...prev, [k]: { ...cur, primaryManual: e.target.value } }
                                })
                              }
                              className={inputClass}
                              placeholder="Full name"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-700">
                          {primaries.map((b) => b.full_name).join(', ') || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[14rem]">
                      {row.needsContingent ? (
                        st.contingentSplitRows && st.contingentSplitRows.length > 0 ? (
                          <div className="space-y-2">
                            {st.contingentSplitRows.map((cr) => (
                              <div
                                key={cr.householdPersonId}
                                className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-2 space-y-1"
                              >
                                <select
                                  value={cr.pickValue}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setRows((prev) => {
                                      const cur = prev[k] ?? fallbackRows[k]!
                                      if (!cur.contingentSplitRows) return prev
                                      return {
                                        ...prev,
                                        [k]: {
                                          ...cur,
                                          contingentSplitRows: cur.contingentSplitRows.map((r) =>
                                            r.householdPersonId === cr.householdPersonId
                                              ? { ...r, pickValue: v }
                                              : r,
                                          ),
                                        },
                                      }
                                    })
                                  }}
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
                                {cr.pickValue === '__manual__' && (
                                  <input
                                    type="text"
                                    value={cr.manual}
                                    onChange={(e) => {
                                      const t = e.target.value
                                      setRows((prev) => {
                                        const cur = prev[k] ?? fallbackRows[k]!
                                        if (!cur.contingentSplitRows) return prev
                                        return {
                                          ...prev,
                                          [k]: {
                                            ...cur,
                                            contingentSplitRows: cur.contingentSplitRows.map((r) =>
                                              r.householdPersonId === cr.householdPersonId
                                                ? { ...r, manual: t }
                                                : r,
                                            ),
                                          },
                                        }
                                      })
                                    }}
                                    className={inputClass}
                                    placeholder="Full name"
                                  />
                                )}
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-neutral-500 shrink-0">Allocation %</label>
                                  <input
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={cr.allocationPct}
                                    onChange={(e) => {
                                      const t = e.target.value
                                      setRows((prev) => {
                                        const cur = prev[k] ?? fallbackRows[k]!
                                        if (!cur.contingentSplitRows) return prev
                                        return {
                                          ...prev,
                                          [k]: {
                                            ...cur,
                                            contingentSplitRows: cur.contingentSplitRows.map((r) =>
                                              r.householdPersonId === cr.householdPersonId
                                                ? { ...r, allocationPct: t }
                                                : r,
                                            ),
                                          },
                                        }
                                      })
                                    }}
                                    className={`${inputClass} min-w-0 flex-1`}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={st.contingentValue}
                              onChange={(e) =>
                                setRows((prev) => {
                                  const cur = prev[k] ?? fallbackRows[k]!
                                  return { ...prev, [k]: { ...cur, contingentValue: e.target.value } }
                                })
                              }
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
                            {st.contingentValue === '__manual__' && (
                              <input
                                type="text"
                                value={st.contingentManual}
                                onChange={(e) =>
                                  setRows((prev) => {
                                    const cur = prev[k] ?? fallbackRows[k]!
                                    return { ...prev, [k]: { ...cur, contingentManual: e.target.value } }
                                  })
                                }
                                className={inputClass}
                                placeholder="Full name"
                              />
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-sm text-neutral-700">
                          {contingents.map((b) => b.full_name).join(', ') || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 pt-2">
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
            {isSubmitting ? 'Saving…' : 'Apply These Defaults'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
