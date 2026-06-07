'use client'

import { memo, useState } from 'react'
import type { AnyTitling, Beneficiary, TitlingKind } from '@/lib/titling/types'
import { formatTitlingDollars, titleLabel } from '@/lib/titling/titlingDisplayHelpers'

export type AssetTitlingCardProps = {
  kind: TitlingKind
  id: string
  name: string
  subtitle: string
  value: number
  ownerLabel: string
  titling: AnyTitling | null
  primaryBens: Beneficiary[]
  contingentBens: Beneficiary[]
  onEditTitling: () => void
  onAddBeneficiary: (type: 'primary' | 'contingent') => void
  onEditBeneficiary: (ben: Beneficiary) => void
  onDeleteBeneficiary: (id: string) => void
}

function BeneficiarySection({
  label,
  bens,
  total,
  confirmDeleteId,
  onAdd,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  label: string
  bens: Beneficiary[]
  total: number
  confirmDeleteId: string | null
  onAdd: () => void
  onEdit: (ben: Beneficiary) => void
  onDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  const allocationOk = bens.length === 0 || Math.abs(total - 100) < 0.01

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
          {bens.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                allocationOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}
            >
              {total.toFixed(0)}%
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy)]"
        >
          + Add
        </button>
      </div>

      {bens.length === 0 ? (
        <p className="text-xs italic text-neutral-400">None added</p>
      ) : (
        <div className="space-y-2">
          {bens.map((ben) => (
            <div
              key={ben.id}
              className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {ben.full_name}
                  {ben.is_gst_skip && (
                    <span className="ml-1 rounded-full bg-[var(--mwm-sage-pale)] px-2 py-0.5 text-xs text-[color:var(--mwm-sage)]">
                      GST Skip
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {ben.relationship && <span>{ben.relationship}</span>}
                  {ben.relationship && (ben.email || ben.phone) && <span> · </span>}
                  {ben.email && <span>{ben.email}</span>}
                  {ben.email && ben.phone && <span> · </span>}
                  {ben.phone && <span>{ben.phone}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-neutral-700">
                  {Number(ben.allocation_pct).toFixed(0)}%
                </span>
                {confirmDeleteId === ben.id ? (
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="text-neutral-500">Delete?</span>
                    <button
                      type="button"
                      onClick={() => onConfirmDelete(ben.id)}
                      className="font-medium text-red-600 hover:text-red-800"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={onCancelDelete}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(ben)}
                      className="text-xs font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(ben.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssetTitlingCardInner({
  name,
  subtitle,
  value,
  ownerLabel,
  titling,
  primaryBens,
  contingentBens,
  onEditTitling,
  onAddBeneficiary,
  onEditBeneficiary,
  onDeleteBeneficiary,
}: Omit<AssetTitlingCardProps, 'kind' | 'id'>) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const primaryTotal = primaryBens.reduce((s, b) => s + Number(b.allocation_pct), 0)
  const contingentTotal = contingentBens.reduce((s, b) => s + Number(b.allocation_pct), 0)

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{name}</p>
            <p className="mt-0.5 text-xs capitalize text-neutral-400">
              {subtitle} · {ownerLabel} · {formatTitlingDollars(value)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            {titling ? (
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {titleLabel(titling.title_type)}
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                No title set
              </span>
            )}
            <button
              type="button"
              onClick={onEditTitling}
              className="text-xs font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy)]"
            >
              {titling ? 'Edit title' : 'Set title'}
            </button>
          </div>
        </div>
      </div>

      {titling?.notes && (
        <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-2">
          <p className="text-xs italic text-neutral-500">{titling.notes}</p>
        </div>
      )}

      <div className="space-y-4 px-5 py-4">
        <BeneficiarySection
          label="Primary beneficiaries"
          bens={primaryBens}
          total={primaryTotal}
          confirmDeleteId={confirmDeleteId}
          onAdd={() => onAddBeneficiary('primary')}
          onEdit={onEditBeneficiary}
          onDelete={(id) => setConfirmDeleteId(id)}
          onConfirmDelete={(id) => {
            onDeleteBeneficiary(id)
            setConfirmDeleteId(null)
          }}
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
        <BeneficiarySection
          label="Contingent beneficiaries"
          bens={contingentBens}
          total={contingentTotal}
          confirmDeleteId={confirmDeleteId}
          onAdd={() => onAddBeneficiary('contingent')}
          onEdit={onEditBeneficiary}
          onDelete={(id) => setConfirmDeleteId(id)}
          onConfirmDelete={(id) => {
            onDeleteBeneficiary(id)
            setConfirmDeleteId(null)
          }}
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
      </div>
    </div>
  )
}

const AssetTitlingCard = memo(AssetTitlingCardInner)
AssetTitlingCard.displayName = 'AssetTitlingCard'

export default AssetTitlingCard
