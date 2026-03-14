'use client'

import { useRef, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import {
  assetFormSchema,
  type AssetFormValues,
  ASSET_TYPES,
  assetTypeLabels,
  type AssetType,
  buildAssetDetails,
} from '@/lib/validations/assets'

const defaultValues: AssetFormValues = {
  type: 'taxable_brokerage',
  name: '',
  value: 0,
  address: '',
  mortgage_balance: '',
  institution: '',
  employer_match_pct: '',
}

const inputClass =
  'block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100'
const labelClass = 'block text-sm font-medium text-zinc-800 dark:text-zinc-200'
const errorClass = 'mt-1 text-sm text-red-600 dark:text-red-400'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  ownerId: string
}

export function AddAssetModal({ open, onClose, onSuccess, ownerId }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema) as Resolver<AssetFormValues>,
    defaultValues,
  })

  const type = watch('type')

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      setSubmitError(null)
      reset(defaultValues)
      el.showModal()
    } else {
      el.close()
    }
  }, [open, reset])

  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose()
  }

  async function onSubmit(values: AssetFormValues) {
    setSubmitError(null)
    const supabase = createClient()
    const { error } = await supabase.from('assets').insert({
      owner_id: ownerId,
      type: values.type,
      name: values.name.trim(),
      value: Number(values.value),
      details: buildAssetDetails(values.type as AssetType, values),
    })
    if (error) {
      setSubmitError(error.message)
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClick={onBackdropClick}
      className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl backdrop:bg-black/20 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add asset
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="asset-type" className={labelClass}>
            Type
          </label>
          <select
            id="asset-type"
            className={inputClass}
            {...register('type')}
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {assetTypeLabels[t]}
              </option>
            ))}
          </select>
          {errors.type && <p className={errorClass}>{errors.type.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="asset-name" className={labelClass}>
            Name
          </label>
          <input
            id="asset-name"
            type="text"
            placeholder="e.g. Vanguard 401(k), Main Street Home"
            className={inputClass}
            {...register('name')}
          />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="asset-value" className={labelClass}>
            Current value ($)
          </label>
          <input
            id="asset-value"
            type="number"
            min={0}
            step={0.01}
            placeholder="0"
            className={inputClass}
            {...register('value', { valueAsNumber: true })}
          />
          {errors.value && <p className={errorClass}>{errors.value.message}</p>}
        </div>

        {/* Primary residence */}
        {(type === 'primary_residence' && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="asset-address" className={labelClass}>
                Address
              </label>
              <input
                id="asset-address"
                type="text"
                placeholder="123 Main St, City, State"
                className={inputClass}
                {...register('address')}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="asset-mortgage" className={labelClass}>
                Mortgage balance ($)
              </label>
              <input
                id="asset-mortgage"
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                className={inputClass}
                {...register('mortgage_balance')}
              />
            </div>
          </>
        )) ||
          null}

        {/* Brokerage / IRAs */}
        {(type === 'taxable_brokerage' ||
          type === 'roth_ira' ||
          type === 'traditional_ira') && (
          <div className="space-y-1.5">
            <label htmlFor="asset-institution" className={labelClass}>
              Institution
            </label>
            <input
              id="asset-institution"
              type="text"
              placeholder="e.g. Vanguard, Fidelity"
              className={inputClass}
              {...register('institution')}
            />
          </div>
        )}

        {/* 401(k) */}
        {type === 'traditional_401k' && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="asset-institution-401k" className={labelClass}>
                Institution
              </label>
              <input
                id="asset-institution-401k"
                type="text"
                placeholder="e.g. Fidelity, Vanguard"
                className={inputClass}
                {...register('institution')}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="asset-employer-match" className={labelClass}>
                Employer match (%)
              </label>
              <input
                id="asset-employer-match"
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="e.g. 50"
                className={inputClass}
                {...register('employer_match_pct')}
              />
            </div>
          </>
        )}

        {submitError && (
          <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isSubmitting ? 'Adding…' : 'Add asset'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
