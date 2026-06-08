'use client'

import { useState, useCallback } from 'react'
import type { TaxRolloverDraft, TaxScanResult } from '@/lib/tax/admin/types'

type Props = {
  yearFilter: number
  onApplied?: (targetYear: number) => void
}

const DOMAIN_LABELS: Record<string, string> = {
  federal_tax_config: 'Federal tax config (exemption, gift exclusion)',
  federal_estate_tax_brackets: 'Federal estate brackets',
  federal_tax_brackets: 'Federal income brackets',
  state_estate_tax_rules: 'State estate rules',
  state_income_tax_brackets: 'State income brackets',
  state_inheritance_tax_rules: 'State inheritance rules',
  irmaa_brackets: 'IRMAA brackets',
}

export default function TaxRulesWorkflow({ yearFilter, onApplied }: Props) {
  const [scanResult, setScanResult] = useState<TaxScanResult | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [draft, setDraft] = useState<TaxRolloverDraft | null>(null)
  const [rolloverLoading, setRolloverLoading] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [ackManual, setAckManual] = useState(false)
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  const [applySuccess, setApplySuccess] = useState<string | null>(null)

  const targetYear = yearFilter + 1
  const sourceYear = yearFilter

  const runScan = useCallback(async () => {
    setScanLoading(true)
    setWorkflowError(null)
    setApplySuccess(null)
    try {
      const res = await fetch(`/api/admin/tax-rules/scan?year=${yearFilter}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scan failed')
      setScanResult(json.data as TaxScanResult)
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : 'Scan failed')
      setScanResult(null)
    } finally {
      setScanLoading(false)
    }
  }, [yearFilter])

  const runRollover = useCallback(async () => {
    setRolloverLoading(true)
    setWorkflowError(null)
    setApplySuccess(null)
    setAckManual(false)
    try {
      const res = await fetch('/api/admin/tax-rules/rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceYear, targetYear }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Rollover failed')
      setDraft(json.data as TaxRolloverDraft)
      if (json.data.targetYearAlreadyHasData) setOverwrite(true)
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : 'Rollover failed')
      setDraft(null)
    } finally {
      setRolloverLoading(false)
    }
  }, [sourceYear, targetYear])

  const runApply = useCallback(async () => {
    if (!draft) return
    setApplyLoading(true)
    setWorkflowError(null)
    setApplySuccess(null)
    try {
      const res = await fetch('/api/admin/tax-rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft,
          overwrite,
          acknowledgedManualVerify: ackManual,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Apply failed')
      const inserted = Object.values(json.data.rowsInserted ?? {}).reduce(
        (a: number, b) => a + Number(b),
        0,
      )
      setApplySuccess(`Committed ${inserted} rows for tax year ${draft.targetYear}.`)
      setDraft(null)
      setAckManual(false)
      onApplied?.(draft.targetYear)
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setApplyLoading(false)
    }
  }, [draft, overwrite, ackManual, onApplied])

  const hasManualFlags = Boolean(
    draft &&
      (draft.manualVerify.sections.length > 0 ||
        draft.manualVerify.stateEstate.length > 0 ||
        draft.manualVerify.stateIncome.length > 0),
  )

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Annual tax rules workflow</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Scan coverage for <strong>{yearFilter}</strong>, draft a rollover to{' '}
          <strong>{targetYear}</strong>, then commit after verifying flagged jurisdictions.
          Federal config is never auto-copied — update exemption and gift exclusion manually.
        </p>
      </div>

      {workflowError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {workflowError}
        </p>
      )}
      {applySuccess && (
        <p className="text-sm text-[color:var(--mwm-sage)] bg-[var(--mwm-sage-pale)] border border-[color:var(--mwm-sage-pale)] rounded-lg px-4 py-3">
          {applySuccess}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runScan}
          disabled={scanLoading}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {scanLoading ? 'Scanning…' : `1. Scan ${yearFilter}`}
        </button>
        <button
          type="button"
          onClick={runRollover}
          disabled={rolloverLoading}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {rolloverLoading ? 'Building draft…' : `2. Rollover ${sourceYear} → ${targetYear}`}
        </button>
      </div>

      {scanResult && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            scanResult.ok
              ? 'border-[color:var(--mwm-sage-pale)] bg-[var(--mwm-sage-pale)] text-[color:var(--mwm-sage)]'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-medium">
            Scan {yearFilter}: {scanResult.ok ? 'all checks passed' : `${scanResult.issues.filter((i) => i.severity === 'error').length} error(s)`}
          </p>
          {scanResult.issues.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
              {scanResult.issues.map((i) => (
                <li key={i.id}>
                  <span className="uppercase font-mono text-[10px] mr-1">{i.severity}</span>
                  {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {draft && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 space-y-3 text-sm text-blue-950">
          <p className="font-medium">
            Draft: {draft.sourceYear} → {draft.targetYear} ({Object.values(draft.counts).reduce((a, b) => a + (b ?? 0), 0)} rows)
          </p>
          <ul className="text-xs grid grid-cols-2 gap-1">
            {Object.entries(draft.counts).map(([k, v]) => (
              <li key={k}>
                {DOMAIN_LABELS[k] ?? k}: {v}
              </li>
            ))}
          </ul>

          {draft.targetYearAlreadyHasData && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              Overwrite existing {draft.targetYear} rows (required — target year already has data)
            </label>
          )}

          {hasManualFlags && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs space-y-2">
              <p className="font-medium">Manual verification required before commit</p>
              {draft.manualVerify.sections.length > 0 && (
                <p>
                  Federal sections:{' '}
                  {draft.manualVerify.sections.map((s) => DOMAIN_LABELS[s] ?? s).join('; ')}
                </p>
              )}
              {draft.manualVerify.stateEstate.length > 0 && (
                <p>State estate (verify brackets/exemptions): {draft.manualVerify.stateEstate.join(', ')}</p>
              )}
              {draft.manualVerify.stateIncome.length > 0 && (
                <p>State income (verify brackets): {draft.manualVerify.stateIncome.join(', ')}</p>
              )}
              {draft.manualVerify.notes && <p className="italic">{draft.manualVerify.notes}</p>}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ackManual}
                  onChange={(e) => setAckManual(e.target.checked)}
                />
                I verified flagged sections and states (or confirmed no changes needed)
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={runApply}
            disabled={applyLoading || (hasManualFlags && !ackManual)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {applyLoading ? 'Committing…' : `3. Commit to ${draft.targetYear}`}
          </button>
        </div>
      )}
    </div>
  )
}
