'use client'

import { useEffect, useRef } from 'react'

export function ProspectSelects({
  state,
  range,
  marital,
  age,
  usStates,
}: {
  state: string
  range: string
  marital: string
  age: number
  usStates: string[]
}) {
  const stateRef = useRef<HTMLSelectElement>(null)
  const rangeRef = useRef<HTMLSelectElement>(null)
  const maritalRef = useRef<HTMLSelectElement>(null)
  const ageRef = useRef<HTMLInputElement>(null)
  const ageLabelRef = useRef<HTMLSpanElement>(null)

  const stateHiddenRef = useRef<HTMLInputElement>(null)
  const rangeHiddenRef = useRef<HTMLInputElement>(null)
  const maritalHiddenRef = useRef<HTMLInputElement>(null)
  const ageHiddenRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (stateHiddenRef.current) stateHiddenRef.current.value = state
    if (rangeHiddenRef.current) rangeHiddenRef.current.value = range
    if (maritalHiddenRef.current) maritalHiddenRef.current.value = marital
    if (ageHiddenRef.current) ageHiddenRef.current.value = String(age)

    const stateEl = stateRef.current
    const rangeEl = rangeRef.current
    const maritalEl = maritalRef.current
    const ageEl = ageRef.current

    const handleState = (e: Event) => {
      if (stateHiddenRef.current) stateHiddenRef.current.value = (e.target as HTMLSelectElement).value
    }
    const handleRange = (e: Event) => {
      console.log('Range changed to:', (e.target as HTMLSelectElement).value)
      if (rangeHiddenRef.current) rangeHiddenRef.current.value = (e.target as HTMLSelectElement).value
    }
    const handleMarital = (e: Event) => {
      if (maritalHiddenRef.current) maritalHiddenRef.current.value = (e.target as HTMLSelectElement).value
    }
    const handleAge = (e: Event) => {
      const val = (e.target as HTMLInputElement).value
      if (ageHiddenRef.current) ageHiddenRef.current.value = val
      if (ageLabelRef.current) ageLabelRef.current.textContent = val
    }

    stateEl?.addEventListener('change', handleState)
    rangeEl?.addEventListener('change', handleRange)
    maritalEl?.addEventListener('change', handleMarital)
    ageEl?.addEventListener('input', handleAge)

    return () => {
      stateEl?.removeEventListener('change', handleState)
      rangeEl?.removeEventListener('change', handleRange)
      maritalEl?.removeEventListener('change', handleMarital)
      ageEl?.removeEventListener('input', handleAge)
    }
  }, [])

  const handleSubmit = () => {
    const form = stateRef.current?.closest('form')
    if (form) form.submit()
  }

  return (
    <>
      <input ref={stateHiddenRef} type="hidden" name="state" />
      <input ref={rangeHiddenRef} type="hidden" name="range" />
      <input ref={maritalHiddenRef} type="hidden" name="marital" />
      <input ref={ageHiddenRef} type="hidden" name="age" />

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">State</label>
        <select
          ref={stateRef}
          defaultValue={state}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        >
          {usStates.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Approximate total assets</label>
        <select
          ref={rangeRef}
          defaultValue={range}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        >
          <option value="sm">$1M – $5M</option>
          <option value="md">$5M – $15M</option>
          <option value="lg">$15M – $30M</option>
          <option value="xl">$30M+</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Marital status</label>
        <select
          ref={maritalRef}
          defaultValue={marital}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        >
          <option value="single">Single</option>
          <option value="married">Married</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
          Age: <span ref={ageLabelRef}>{age}</span>
        </label>
        <input
          ref={ageRef}
          type="range"
          min="35"
          max="85"
          defaultValue={age}
          className="w-full"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        className="w-full py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition"
      >
        Generate Summary
      </button>
    </>
  )
}
