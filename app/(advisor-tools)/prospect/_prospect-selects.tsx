'use client'

import { useState } from 'react'

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
  const [currentAge, setCurrentAge] = useState(age)
  const [currentRange, setCurrentRange] = useState(range)
  const [currentState, setCurrentState] = useState(state)
  const [currentMarital, setCurrentMarital] = useState(marital)

  return (
    <>
      <input type="hidden" name="state" value={currentState} />
      <input type="hidden" name="range" value={currentRange} />
      <input type="hidden" name="marital" value={currentMarital} />
      <input type="hidden" name="age" value={currentAge} />

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">State</label>
        <select
          value={currentState}
          onChange={(e) => setCurrentState(e.target.value)}
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
          value={currentRange}
          onChange={(e) => setCurrentRange(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        >
          <option value="sm">$1M - $5M</option>
          <option value="md">$5M - $15M</option>
          <option value="lg">$15M - $30M</option>
          <option value="xl">$30M+</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Marital status</label>
        <select
          value={currentMarital}
          onChange={(e) => setCurrentMarital(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        >
          <option value="single">Single</option>
          <option value="married">Married</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Age: {currentAge}</label>
        <input
          type="range"
          min="35"
          max="85"
          value={currentAge}
          onChange={(e) => setCurrentAge(parseInt(e.target.value))}
          className="w-full"
        />
      </div>
    </>
  )
}
