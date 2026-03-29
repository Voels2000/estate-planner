'use client'

import { useState, type FormEvent } from 'react'

import type { DomicileAnalysisRow } from './types'

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
] as const

export interface StateEntry {
  state: string
  days_per_year: number
}

export interface DomicileFormPayload {
  claimed_domicile_state: string
  states: StateEntry[]
  drivers_license_state: string | null
  voter_registration_state: string | null
  vehicle_registration_state: string | null
  primary_home_titled_state: string | null
  spouse_children_state: string | null
  estate_docs_declare_state: string | null
  business_interests_state: string | null
  files_taxes_in_state: string | null
}

function statesFromAnalysis(ex: DomicileAnalysisRow | null | undefined): StateEntry[] {
  const raw = ex?.states
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ state: '', days_per_year: 0 }]
  }
  const first = raw[0]
  if (typeof first === 'string') {
    return (raw as string[]).map((state) => ({ state, days_per_year: 0 }))
  }
  return (raw as StateEntry[]).map((s) => ({
    state: typeof s?.state === 'string' ? s.state : '',
    days_per_year: typeof s?.days_per_year === 'number' ? s.days_per_year : 0,
  }))
}

interface Props {
  onSubmit: (data: DomicileFormPayload) => void
  loading: boolean
  existingAnalysis: DomicileAnalysisRow | null
  maxStates: number
}

export default function DomicileForm({
  onSubmit,
  loading,
  existingAnalysis,
  maxStates,
}: Props) {
  const ex = existingAnalysis

  const [claimedState, setClaimedState] = useState(
    () => (ex?.claimed_domicile_state as string | undefined) ?? ''
  )
  const [states, setStates] = useState<StateEntry[]>(() => statesFromAnalysis(ex))
  const [driversLicense, setDriversLicense] = useState(
    () => (ex?.drivers_license_state as string | undefined) ?? ''
  )
  const [voterReg, setVoterReg] = useState(
    () => (ex?.voter_registration_state as string | undefined) ?? ''
  )
  const [vehicleReg, setVehicleReg] = useState(
    () => (ex?.vehicle_registration_state as string | undefined) ?? ''
  )
  const [primaryHome, setPrimaryHome] = useState(
    () => (ex?.primary_home_titled_state as string | undefined) ?? ''
  )
  const [spouseChildren, setSpouseChildren] = useState(
    () => (ex?.spouse_children_state as string | undefined) ?? ''
  )
  const [estateDocs, setEstateDocs] = useState(
    () => (ex?.estate_docs_declare_state as string | undefined) ?? ''
  )
  const [businessState, setBusinessState] = useState(
    () => (ex?.business_interests_state as string | undefined) ?? ''
  )
  const [filesTaxes, setFilesTaxes] = useState(
    () => (ex?.files_taxes_in_state as string | undefined) ?? ''
  )

  function addState() {
    if (states.length < maxStates) {
      setStates([...states, { state: '', days_per_year: 0 }])
    }
  }

  function removeState(index: number) {
    setStates(states.filter((_, i) => i !== index))
  }

  function updateState(index: number, field: keyof StateEntry, value: string | number) {
    setStates(states.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      claimed_domicile_state: claimedState,
      states: states.filter((s) => s.state !== ''),
      drivers_license_state: driversLicense || null,
      voter_registration_state: voterReg || null,
      vehicle_registration_state: vehicleReg || null,
      primary_home_titled_state: primaryHome || null,
      spouse_children_state: spouseChildren || null,
      estate_docs_declare_state: estateDocs || null,
      business_interests_state: businessState || null,
      files_taxes_in_state: filesTaxes || null,
    })
  }

  const selectClass =
    'w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h2 className="text-base font-medium text-gray-900 mb-4">Claimed domicile state</h2>
        <div className="max-w-xs">
          <label className={labelClass}>State you intend as your permanent home</label>
          <select
            required
            value={claimedState}
            onChange={(e) => setClaimedState(e.target.value)}
            className={selectClass}
          >
            <option value="">Select state</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <h2 className="text-base font-medium text-gray-900 mb-1">States and days spent per year</h2>
        <p className="text-sm text-gray-500 mb-4">
          Include every state where you spend time. Days over 183 in any state can trigger statutory
          residency.
        </p>
        <div className="space-y-3">
          {states.map((entry, i) => (
            <div key={i} className="flex gap-3 items-end">
              <div className="flex-1 max-w-xs">
                <label className={labelClass}>State</label>
                <select
                  value={entry.state}
                  onChange={(e) => updateState(i, 'state', e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className={labelClass}>Days / year</label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={entry.days_per_year}
                  onChange={(e) =>
                    updateState(i, 'days_per_year', parseInt(e.target.value, 10) || 0)
                  }
                  className={selectClass}
                />
              </div>
              {states.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeState(i)}
                  className="text-sm text-red-500 hover:text-red-700 pb-2"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {states.length < maxStates && (
          <button
            type="button"
            onClick={addState}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add another state
          </button>
        )}
      </div>

      <div>
        <h2 className="text-base font-medium text-gray-900 mb-1">Domicile factors</h2>
        <p className="text-sm text-gray-500 mb-4">
          Courts use these objective factors to determine your true domicile. Leave blank if not
          applicable.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Driver&apos;s license state</label>
            <select
              value={driversLicense}
              onChange={(e) => setDriversLicense(e.target.value)}
              className={selectClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Voter registration state</label>
            <select
              value={voterReg}
              onChange={(e) => setVoterReg(e.target.value)}
              className={selectClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Vehicle registration state</label>
            <select
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value)}
              className={selectClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Primary home titled in</label>
            <select
              value={primaryHome}
              onChange={(e) => setPrimaryHome(e.target.value)}
              className={selectClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Spouse / minor children reside in</label>
            <select
              value={spouseChildren}
              onChange={(e) => setSpouseChildren(e.target.value)}
              className={selectClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Estate docs declare domicile in</label>
            <select
              value={estateDocs}
              onChange={(e) => setEstateDocs(e.target.value)}
              className={selectClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Primary business interests in</label>
            <select
              value={businessState}
              onChange={(e) => setBusinessState(e.target.value)}
              className={selectClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Files state taxes in</label>
            <select
              value={filesTaxes}
              onChange={(e) => setFilesTaxes(e.target.value)}
              className={selectClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !claimedState}
        className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Analysing...' : existingAnalysis ? 'Re-run analysis' : 'Run analysis'}
      </button>
    </form>
  )
}
