'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  BILLING_CAPABILITY_ROWS,
  billingMatrixRowsByGroup,
  isBillingCapabilityIncluded,
  type BillingMatrixTier,
} from '@/lib/billing/billingCapabilityMatrix'
import type { BillingTierColumn } from '@/lib/billing/billingTierPresentation'

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CapabilityCell({
  included,
  highlighted,
}: {
  included: boolean
  highlighted: boolean
}) {
  if (!included) {
    return <span className="text-neutral-300">—</span>
  }
  return (
    <CheckIcon
      className={`mx-auto h-5 w-5 ${highlighted ? 'text-[color:var(--mwm-navy)]' : 'text-[color:var(--mwm-gold)]'}`}
    />
  )
}

function TierHeaderCell({ column }: { column: BillingTierColumn }) {
  return (
    <div
      className={`flex h-full flex-col px-3 py-4 text-center ${
        column.highlighted
          ? 'rounded-t-xl bg-[color:var(--mwm-navy)]/5 ring-1 ring-inset ring-[color:var(--mwm-navy)]/15'
          : ''
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mwm-text-muted)]">
        {column.name}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[color:var(--mwm-navy)]">
        {column.priceMain}
      </p>
      {column.priceSub && (
        <p className="text-xs text-[color:var(--mwm-text-muted)]">{column.priceSub}</p>
      )}
      <p className="mt-3 text-xs font-medium italic text-[color:var(--mwm-text-secondary)]">
        {column.question}
      </p>
    </div>
  )
}

type Props = {
  columns: BillingTierColumn[]
  /** Mobile default focus — Estate unless user has active paid tier. */
  mobileFocusTier?: BillingMatrixTier
}

export function BillingCapabilityMatrix({ columns, mobileFocusTier = 3 }: Props) {
  const [compareOpen, setCompareOpen] = useState(false)
  const groups = useMemo(() => billingMatrixRowsByGroup(), [])

  const focusColumn =
    columns.find((c) => c.tier === mobileFocusTier) ?? columns[columns.length - 1]

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-[color:var(--mwm-text-secondary)]">
        Each plan includes everything in the plans before it.
      </p>

      {/* Desktop matrix */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-[28%] pb-2 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--mwm-text-muted)]">
                Capability
              </th>
              {columns.map((col) => (
                <th key={col.tier} className="w-[18%] align-bottom">
                  <TierHeaderCell column={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.group}>
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="border-t border-[color:var(--mwm-border)] bg-[var(--mwm-off-white)] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--mwm-navy)]"
                  >
                    {group.label}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="border-t border-[color:var(--mwm-border)]">
                    <td className="py-3 pr-4 text-[color:var(--mwm-text-secondary)]">
                      {row.label}
                    </td>
                    {columns.map((col) => {
                      const included = isBillingCapabilityIncluded(row, col.tier)
                      return (
                        <td
                          key={col.tier}
                          className={`py-3 text-center ${
                            col.highlighted ? 'bg-[color:var(--mwm-navy)]/5' : ''
                          }`}
                        >
                          <CapabilityCell included={included} highlighted={col.highlighted} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: focused plan + expandable compare */}
      <div className="lg:hidden">
        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            focusColumn.highlighted
              ? 'border-[color:var(--mwm-navy)]/20 bg-[color:var(--mwm-navy)]/5'
              : 'border-[color:var(--mwm-border)] bg-white'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mwm-text-muted)]">
            {focusColumn.name}
          </p>
          <p className="mt-1 text-3xl font-bold text-[color:var(--mwm-navy)]">
            {focusColumn.priceMain}
            {focusColumn.priceSub && (
              <span className="ml-1 text-base font-normal text-[color:var(--mwm-text-muted)]">
                {focusColumn.priceSub}
              </span>
            )}
          </p>
          <p className="mt-2 text-sm text-[color:var(--mwm-text-secondary)]">
            {focusColumn.oneLiner}
          </p>
          <ul className="mt-4 space-y-2">
            {BILLING_CAPABILITY_ROWS.filter((row) =>
              isBillingCapabilityIncluded(row, focusColumn.tier),
            ).map((row) => (
              <li key={row.label} className="flex gap-2 text-sm text-[color:var(--mwm-text-secondary)]">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--mwm-gold)]" />
                <span>{row.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => setCompareOpen((v) => !v)}
          className="mt-4 w-full rounded-lg border border-[color:var(--mwm-border)] bg-white px-4 py-3 text-sm font-medium text-[color:var(--mwm-navy)]"
          aria-expanded={compareOpen}
        >
          {compareOpen ? 'Hide plan comparison' : 'Compare all plans'}
        </button>

        {compareOpen && (
          <div className="mt-4 space-y-6 rounded-2xl border border-[color:var(--mwm-border)] bg-white p-4">
            {columns.map((col) => (
              <div
                key={col.tier}
                className={`border-b border-[color:var(--mwm-border)] pb-4 last:border-0 last:pb-0 ${
                  col.highlighted ? 'rounded-lg bg-[color:var(--mwm-navy)]/5 p-3' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-[color:var(--mwm-navy)]">{col.name}</h3>
                  <span className="text-sm font-medium tabular-nums text-[color:var(--mwm-navy)]">
                    {col.priceMain}
                    {col.priceSub ? ` ${col.priceSub}` : ''}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {groups.flatMap((g) =>
                    g.rows
                      .filter((row) => isBillingCapabilityIncluded(row, col.tier))
                      .map((row) => (
                        <li
                          key={`${col.tier}-${row.label}`}
                          className="text-xs text-[color:var(--mwm-text-muted)]"
                        >
                          {row.label}
                        </li>
                      )),
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
