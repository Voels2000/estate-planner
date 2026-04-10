'use client'

import type { ChangeEvent } from 'react'
import type { RefOption } from '@/lib/ref-data-fetchers'

interface RefSelectProps {
  name: string
  label: string
  options: RefOption[]
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
  helpText?: string
  className?: string
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
}

export function RefSelect({
  name,
  label,
  options,
  defaultValue,
  required = false,
  placeholder = 'Select...',
  helpText,
  className = '',
  onChange,
}: RefSelectProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-neutral-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        onChange={onChange}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} title={opt.description ?? undefined}>
            {opt.label}
          </option>
        ))}
      </select>
      {helpText && <p className="text-xs text-neutral-400 mt-1">{helpText}</p>}
    </div>
  )
}

interface CurrencyInputProps {
  name: string
  label: string
  defaultValue?: number | null
  required?: boolean
  helpText?: string
  placeholder?: string
}

export function CurrencyInput({
  name,
  label,
  defaultValue,
  required = false,
  helpText,
  placeholder = '0',
}: CurrencyInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">$</span>
        <input
          type="number"
          name={name}
          defaultValue={defaultValue ?? ''}
          required={required}
          placeholder={placeholder}
          min="0"
          step="1"
          className="pl-7 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      {helpText && <p className="text-xs text-neutral-400 mt-1">{helpText}</p>}
    </div>
  )
}

interface PctInputProps {
  name: string
  label: string
  defaultValue?: number | null
  helpText?: string
  min?: number
  max?: number
}

export function PctInput({
  name,
  label,
  defaultValue,
  helpText,
  min = 0,
  max = 100,
}: PctInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          name={name}
          defaultValue={defaultValue ?? ''}
          min={min}
          max={max}
          step="0.1"
          className="pr-8 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="absolute right-3 top-2.5 text-neutral-400 text-sm">%</span>
      </div>
      {helpText && <p className="text-xs text-neutral-400 mt-1">{helpText}</p>}
    </div>
  )
}

interface ToggleFieldProps {
  name: string
  label: string
  defaultChecked?: boolean
  helpText?: string
}

export function ToggleField({
  name,
  label,
  defaultChecked = false,
  helpText,
}: ToggleFieldProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        id={name}
        defaultChecked={defaultChecked}
        value="true"
        className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
      />
      <div>
        <label htmlFor={name} className="text-sm font-medium text-neutral-700 cursor-pointer">
          {label}
        </label>
        {helpText && <p className="text-xs text-neutral-400 mt-0.5">{helpText}</p>}
      </div>
    </div>
  )
}
