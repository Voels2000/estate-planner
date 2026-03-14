'use client'

import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import {
  householdFormSchema,
  type HouseholdFormValues,
  FILING_STATUSES,
  type HouseholdRow,
} from '@/lib/validations/household'
import { useState } from 'react'

const filingStatusLabels: Record<(typeof FILING_STATUSES)[number], string> = {
  single: 'Single',
  married_filing_jointly: 'Married filing jointly',
  married_filing_separately: 'Married filing separately',
  head_of_household: 'Head of household',
  qualifying_surviving_spouse: 'Qualifying surviving spouse',
}

type Props = {
  userId: string
  initialValues?: Partial<HouseholdFormValues>
}

const defaultValues: HouseholdFormValues = {
  person1_name: '',
  person1_birth_year: undefined,
  person1_retirement_age: undefined,
  person1_ss_claiming_age: undefined,
  person1_longevity_age: undefined,
  has_spouse: false,
  person2_name: '',
  person2_birth_year: undefined,
  person2_retirement_age: undefined,
  person2_ss_claiming_age: undefined,
  person2_longevity_age: undefined,
  filing_status: 'single',
  state_primary: '',
  state_compare: '',
  inflation_rate: 3,
}

export function HouseholdProfileForm({ userId, initialValues }: Props) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<HouseholdFormValues>({
    resolver: zodResolver(householdFormSchema) as Resolver<HouseholdFormValues>,
    defaultValues: { ...defaultValues, ...initialValues },
  })

  const hasSpouse = watch('has_spouse')

  const num = (v: number | undefined | null): number | null =>
    v != null && !Number.isNaN(v) ? Number(v) : null

  async function onSubmit(values: HouseholdFormValues) {
    setMessage(null)
    const supabase = createClient()

    const row: HouseholdRow = {
      owner_id: userId,
      person1_name: values.person1_name.trim(),
      person1_birth_year: num(values.person1_birth_year),
      person1_retirement_age: num(values.person1_retirement_age),
      person1_ss_claiming_age: num(values.person1_ss_claiming_age),
      person1_longevity_age: num(values.person1_longevity_age),
      has_spouse: values.has_spouse,
      person2_name: values.has_spouse && values.person2_name?.trim() ? values.person2_name.trim() : null,
      person2_birth_year: values.has_spouse ? num(values.person2_birth_year) : null,
      person2_retirement_age: values.has_spouse ? num(values.person2_retirement_age) : null,
      person2_ss_claiming_age: values.has_spouse ? num(values.person2_ss_claiming_age) : null,
      person2_longevity_age: values.has_spouse ? num(values.person2_longevity_age) : null,
      filing_status: values.filing_status,
      state_primary: values.state_primary?.trim().toUpperCase().slice(0, 2) || null,
      state_compare: values.state_compare?.trim().toUpperCase().slice(0, 2) || null,
      inflation_rate: Number.isNaN(Number(values.inflation_rate)) ? 3 : Number(values.inflation_rate),
    }

    const { error } = await supabase.from('households').upsert(row, {
      onConflict: 'owner_id',
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    setMessage({ type: 'success', text: 'Profile saved.' })
  }

  const inputClass =
    'block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100'
  const labelClass = 'block text-sm font-medium text-zinc-800 dark:text-zinc-200'
  const errorClass = 'mt-1 text-sm text-red-600 dark:text-red-400'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 max-w-xl space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="person1_name" className={labelClass}>
          Primary person name
        </label>
        <input
          id="person1_name"
          type="text"
          placeholder="Full name"
          className={inputClass}
          {...register('person1_name')}
        />
        {errors.person1_name && (
          <p className={errorClass}>{errors.person1_name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor="person1_birth_year" className={labelClass}>
            Birth year
          </label>
          <input
            id="person1_birth_year"
            type="number"
            min={1900}
            max={2100}
            placeholder="e.g. 1965"
            className={inputClass}
            {...register('person1_birth_year', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="person1_retirement_age" className={labelClass}>
            Retirement age
          </label>
          <input
            id="person1_retirement_age"
            type="number"
            min={18}
            max={100}
            placeholder="65"
            className={inputClass}
            {...register('person1_retirement_age', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="person1_ss_claiming_age" className={labelClass}>
            SS claiming age
          </label>
          <input
            id="person1_ss_claiming_age"
            type="number"
            min={62}
            max={70}
            placeholder="70"
            className={inputClass}
            {...register('person1_ss_claiming_age', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="person1_longevity_age" className={labelClass}>
            Longevity age
          </label>
          <input
            id="person1_longevity_age"
            type="number"
            min={50}
            max={120}
            placeholder="95"
            className={inputClass}
            {...register('person1_longevity_age', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="has_spouse"
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:ring-zinc-100"
          {...register('has_spouse')}
        />
        <label htmlFor="has_spouse" className={labelClass}>
          Has spouse
        </label>
      </div>

      {hasSpouse && (
        <>
          <div className="space-y-1.5">
            <label htmlFor="person2_name" className={labelClass}>
              Spouse name
            </label>
            <input
              id="person2_name"
              type="text"
              placeholder="Full name"
              className={inputClass}
              {...register('person2_name')}
            />
            {errors.person2_name && (
              <p className={errorClass}>{errors.person2_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="person2_birth_year" className={labelClass}>
                Spouse birth year
              </label>
              <input
                id="person2_birth_year"
                type="number"
                min={1900}
                max={2100}
                placeholder="e.g. 1968"
                className={inputClass}
                {...register('person2_birth_year', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="person2_retirement_age" className={labelClass}>
                Retirement age
              </label>
              <input
                id="person2_retirement_age"
                type="number"
                min={18}
                max={100}
                placeholder="65"
                className={inputClass}
                {...register('person2_retirement_age', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="person2_ss_claiming_age" className={labelClass}>
                SS claiming age
              </label>
              <input
                id="person2_ss_claiming_age"
                type="number"
                min={62}
                max={70}
                placeholder="70"
                className={inputClass}
                {...register('person2_ss_claiming_age', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="person2_longevity_age" className={labelClass}>
                Longevity age
              </label>
              <input
                id="person2_longevity_age"
                type="number"
                min={50}
                max={120}
                placeholder="95"
                className={inputClass}
                {...register('person2_longevity_age', { valueAsNumber: true })}
              />
            </div>
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <label htmlFor="filing_status" className={labelClass}>
          Filing status
        </label>
        <select
          id="filing_status"
          className={inputClass}
          {...register('filing_status')}
        >
          {FILING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {filingStatusLabels[status]}
            </option>
          ))}
        </select>
        {errors.filing_status && (
          <p className={errorClass}>{errors.filing_status.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="state_primary" className={labelClass}>
            State (primary)
          </label>
          <input
            id="state_primary"
            type="text"
            placeholder="e.g. CA"
            maxLength={2}
            className={inputClass}
            {...register('state_primary')}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            2-letter state code
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="state_compare" className={labelClass}>
            State (compare)
          </label>
          <input
            id="state_compare"
            type="text"
            placeholder="e.g. NY"
            maxLength={2}
            className={inputClass}
            {...register('state_compare')}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            2-letter state code
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="inflation_rate" className={labelClass}>
          Inflation assumption (%)
        </label>
        <input
          id="inflation_rate"
          type="number"
          min={0}
          max={20}
          step={0.1}
          placeholder="3"
          className={inputClass}
          {...register('inflation_rate', { valueAsNumber: true })}
        />
        {errors.inflation_rate && (
          <p className={errorClass}>{errors.inflation_rate.message}</p>
        )}
      </div>

      {message && (
        <p
          className={
            message.type === 'success'
              ? 'text-sm text-green-600 dark:text-green-400'
              : 'text-sm text-red-600 dark:text-red-400'
          }
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full max-w-xl items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
