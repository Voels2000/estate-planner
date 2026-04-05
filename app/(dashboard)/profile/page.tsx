'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const FILING_STATUSES = ['single', 'mfj', 'mfs', 'hoh', 'qw']
const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  mfj: 'Married Filing Jointly',
  mfs: 'Married Filing Separately',
  hoh: 'Head of Household',
  qw: 'Qualifying Widow(er)',
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

function calcSSBenefit(benefit62: string, benefit67: string, claimAge: string): number | null {
  const b62 = parseFloat(benefit62)
  const b67 = parseFloat(benefit67)
  const age = parseInt(claimAge)
  if (!b67 || !age) return null
  if (age <= 62) return b62 || b67 * 0.7
  if (age === 67) return b67
  if (age < 67) {
    const slope = (b67 - (b62 || b67 * 0.7)) / (67 - 62)
    return (b62 || b67 * 0.7) + slope * (age - 62)
  }
  return b67 * (1 + 0.08 * (age - 67))
}

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [householdId, setHouseholdId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')

  const [householdName, setHouseholdName] = useState('')
  const [person1Name, setPerson1Name] = useState('')
  const [person1BirthYear, setPerson1BirthYear] = useState('')
  const [person1RetirementAge, setPerson1RetirementAge] = useState('')
  const [person1SSClaimingAge, setPerson1SSClaimingAge] = useState('')
  const [person1LongevityAge, setPerson1LongevityAge] = useState('')
  const [person1SSBenefit62, setPerson1SSBenefit62] = useState('')
  const [person1SSBenefit67, setPerson1SSBenefit67] = useState('')

  const [hasSpouse, setHasSpouse] = useState(false)
  const [person2Name, setPerson2Name] = useState('')
  const [person2BirthYear, setPerson2BirthYear] = useState('')
  const [person2RetirementAge, setPerson2RetirementAge] = useState('')
  const [person2SSClaimingAge, setPerson2SSClaimingAge] = useState('')
  const [person2LongevityAge, setPerson2LongevityAge] = useState('')
  const [person2SSBenefit62, setPerson2SSBenefit62] = useState('')
  const [person2SSBenefit67, setPerson2SSBenefit67] = useState('')

  // FIX 1: filing_status stored as plain text in state — no enum casting needed.
  // The prior bug was that `filing_status` on the households table may be a Postgres
  // enum. We cast it explicitly to ::text on upsert by sending it as a plain string,
  // which Supabase JS handles correctly. The real issue was that hasSpouse toggling
  // caused a race between two separate .update() calls and the SS delete/insert,
  // where an error in the SS block was swallowed (console.error) but then
  // setIsSubmitting was never reset, leaving the button stuck.
  // Additionally the SS delete used .eq('ss_person','person1') but some rows may
  // have been inserted with owner field instead. Fixed below.
  const [filingStatus, setFilingStatus] = useState('single')
  const [statePrimary, setStatePrimary] = useState('')
  const [stateCompare, setStateCompare] = useState('')
  const [inflationRate, setInflationRate] = useState('2.5')
  const [riskTolerance, setRiskTolerance] = useState('moderate')
  const [growthRateAccumulation, setGrowthRateAccumulation] = useState('7')
  const [growthRateRetirement, setGrowthRateRetirement] = useState('5')
  const [deductionMode, setDeductionMode] = useState<'standard' | 'custom' | 'none'>('standard')
  const [customDeductionAmount, setCustomDeductionAmount] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name ?? '')
        setEmail(profile.email ?? user.email ?? '')
      }

      const { data: household } = await supabase
        .from('households')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (household) {
        setHouseholdId(household.id)
        setHouseholdName(household.name ?? '')
        setPerson1Name(household.person1_name ?? '')
        setPerson1BirthYear(household.person1_birth_year?.toString() ?? '')
        setPerson1RetirementAge(household.person1_retirement_age?.toString() ?? '')
        setPerson1SSClaimingAge(household.person1_ss_claiming_age?.toString() ?? '')
        setPerson1LongevityAge(household.person1_longevity_age?.toString() ?? '')
        setPerson1SSBenefit62(household.person1_ss_benefit_62?.toString() ?? '')
        setPerson1SSBenefit67(household.person1_ss_benefit_67?.toString() ?? '')
        setHasSpouse(household.has_spouse ?? false)
        setPerson2Name(household.person2_name ?? '')
        setPerson2BirthYear(household.person2_birth_year?.toString() ?? '')
        setPerson2RetirementAge(household.person2_retirement_age?.toString() ?? '')
        setPerson2SSClaimingAge(household.person2_ss_claiming_age?.toString() ?? '')
        setPerson2LongevityAge(household.person2_longevity_age?.toString() ?? '')
        setPerson2SSBenefit62(household.person2_ss_benefit_62?.toString() ?? '')
        setPerson2SSBenefit67(household.person2_ss_benefit_67?.toString() ?? '')
        // FIX 1: Ensure filing_status always resolves to a valid string.
        // If the DB returns null or an unexpected value, fall back to 'single'.
        const fs = household.filing_status
        setFilingStatus(FILING_STATUSES.includes(fs) ? fs : 'single')
        setStatePrimary(household.state_primary ?? '')
        setStateCompare(household.state_compare ?? '')
        setInflationRate(household.inflation_rate?.toString() ?? '2.5')
        setRiskTolerance(household.risk_tolerance ?? 'moderate')
        setGrowthRateAccumulation(household.growth_rate_accumulation?.toString() ?? '7')
        setGrowthRateRetirement(household.growth_rate_retirement?.toString() ?? '5')
        setDeductionMode(household.deduction_mode ?? 'standard')
        setCustomDeductionAmount(household.custom_deduction_amount?.toString() ?? '')
      }

      setIsLoading(false)
    }
    load()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Save profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email: email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // FIX 1: Build household data with filing_status as a plain string.
      // Previously this was identical — the bug was NOT in the data shape but in
      // how errors from the SS upsert block were handled. If the SS delete/insert
      // threw, isSubmitting was stuck true and no error was shown to the user.
      // Now all SS errors are surfaced properly (throw instead of console.error).
      const householdData = {
        owner_id: user.id,
        name: householdName || `${fullName}'s Household`,
        person1_name: person1Name,
        person1_first_name: person1Name.trim().split(' ')[0] || null,
        person1_last_name: person1Name.trim().split(' ').slice(1).join(' ') || null,
        person1_birth_year: parseInt(person1BirthYear) || null,
        person1_retirement_age: parseInt(person1RetirementAge) || null,
        person1_ss_claiming_age: parseInt(person1SSClaimingAge) || null,
        person1_longevity_age: parseInt(person1LongevityAge) || null,
        person1_ss_benefit_62: parseFloat(person1SSBenefit62) || null,
        person1_ss_benefit_67: parseFloat(person1SSBenefit67) || null,
        has_spouse: hasSpouse,
        person2_name: hasSpouse ? person2Name : null,
        person2_first_name: hasSpouse ? (person2Name.trim().split(' ')[0] || null) : null,
        person2_last_name: hasSpouse ? (person2Name.trim().split(' ').slice(1).join(' ') || null) : null,
        person2_birth_year: hasSpouse ? parseInt(person2BirthYear) || null : null,
        person2_retirement_age: hasSpouse ? parseInt(person2RetirementAge) || null : null,
        person2_ss_claiming_age: hasSpouse ? parseInt(person2SSClaimingAge) || null : null,
        person2_longevity_age: hasSpouse ? parseInt(person2LongevityAge) || null : null,
        person2_ss_benefit_62: hasSpouse ? parseFloat(person2SSBenefit62) || null : null,
        person2_ss_benefit_67: hasSpouse ? parseFloat(person2SSBenefit67) || null : null,
        filing_status: filingStatus,  // plain string — Supabase coerces to enum safely
        state_primary: statePrimary || null,
        state_compare: stateCompare || null,
        inflation_rate: parseFloat(inflationRate) || 2.5,
        risk_tolerance: riskTolerance,
        growth_rate_accumulation: Number(growthRateAccumulation) || 7,
        growth_rate_retirement: Number(growthRateRetirement) || 5,
        deduction_mode: deductionMode,
        custom_deduction_amount: parseFloat(customDeductionAmount) || 0,
        updated_at: new Date().toISOString(),
      }

      if (householdId) {
        const { error } = await supabase
          .from('households')
          .update(householdData)
          .eq('id', householdId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('households')
          .insert(householdData)
        if (error) throw error

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        // If advisor, grant Tier 3 access on first profile completion
        if (profile?.role === 'advisor') {
          await supabase
            .from('profiles')
            .update({ consumer_tier: 3 })
            .eq('id', user.id)
        }
      }

      // SS is handled entirely by the projection engine via households table.
      // No SS rows are written to the income table.
      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Your Profile</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Complete your household information for accurate projections.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full Name" required>
              <input type="text" required value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass} placeholder="Jane Doe" />
            </Field>
            <Field label="Email">
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass} placeholder="you@example.com" />
            </Field>
            <Field label="Household Name">
              <input type="text" value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className={inputClass} placeholder="The Smith Household" />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Your Information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Your Name" required>
              <input type="text" required value={person1Name}
                onChange={(e) => setPerson1Name(e.target.value)}
                className={inputClass} placeholder="Jane" />
            </Field>
            <Field label="Birth Year" required>
              <input type="number" min="1920" max="2005" required value={person1BirthYear}
                onChange={(e) => setPerson1BirthYear(e.target.value)}
                className={inputClass} placeholder="1970" />
            </Field>
            <Field label="Retirement Age">
              <input type="number" min="50" max="80" value={person1RetirementAge}
                onChange={(e) => setPerson1RetirementAge(e.target.value)}
                className={inputClass} placeholder="65" />
            </Field>
            <Field label="Social Security Claiming Age">
              <input type="number" min="62" max="70" value={person1SSClaimingAge}
                onChange={(e) => setPerson1SSClaimingAge(e.target.value)}
                className={inputClass} placeholder="67" />
            </Field>
            <Field label="Longevity Age (life expectancy)">
              <input type="number" min="70" max="110" value={person1LongevityAge}
                onChange={(e) => setPerson1LongevityAge(e.target.value)}
                className={inputClass} placeholder="90" />
            </Field>
            <Field label="SS Monthly Benefit at Age 62 (from SS statement)">
              <input type="number" min="0" value={person1SSBenefit62}
                onChange={(e) => setPerson1SSBenefit62(e.target.value)}
                className={inputClass} placeholder="e.g. 1800" />
            </Field>
            <Field label="SS Monthly Benefit at Age 67 (from SS statement)">
              <input type="number" min="0" value={person1SSBenefit67}
                onChange={(e) => setPerson1SSBenefit67(e.target.value)}
                className={inputClass} placeholder="e.g. 2400" />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <input id="hasSpouse" type="checkbox" checked={hasSpouse}
              onChange={(e) => setHasSpouse(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300" />
            <label htmlFor="hasSpouse" className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Include Spouse / Partner
            </label>
          </div>
          {hasSpouse && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Spouse Name">
                <input type="text" value={person2Name}
                  onChange={(e) => setPerson2Name(e.target.value)}
                  className={inputClass} placeholder="John" />
              </Field>
              <Field label="Spouse Birth Year">
                <input type="number" min="1920" max="2005" value={person2BirthYear}
                  onChange={(e) => setPerson2BirthYear(e.target.value)}
                  className={inputClass} placeholder="1968" />
              </Field>
              <Field label="Spouse Retirement Age">
                <input type="number" min="50" max="80" value={person2RetirementAge}
                  onChange={(e) => setPerson2RetirementAge(e.target.value)}
                  className={inputClass} placeholder="65" />
              </Field>
              <Field label="Spouse SS Claiming Age">
                <input type="number" min="62" max="70" value={person2SSClaimingAge}
                  onChange={(e) => setPerson2SSClaimingAge(e.target.value)}
                  className={inputClass} placeholder="67" />
              </Field>
              <Field label="Spouse Longevity Age">
                <input type="number" min="70" max="110" value={person2LongevityAge}
                  onChange={(e) => setPerson2LongevityAge(e.target.value)}
                  className={inputClass} placeholder="88" />
              </Field>
              <Field label="Spouse SS Monthly Benefit at Age 62">
                <input type="number" min="0" value={person2SSBenefit62}
                  onChange={(e) => setPerson2SSBenefit62(e.target.value)}
                  className={inputClass} placeholder="e.g. 1400" />
              </Field>
              <Field label="Spouse SS Monthly Benefit at Age 67">
                <input type="number" min="0" value={person2SSBenefit67}
                  onChange={(e) => setPerson2SSBenefit67(e.target.value)}
                  className={inputClass} placeholder="e.g. 1900" />
              </Field>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Tax &amp; Location
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Filing Status">
              <select
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value)}
                className={inputClass}
              >
                {FILING_STATUSES.map((s) => (
                  <option key={s} value={s}>{FILING_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Primary State">
              <select value={statePrimary}
                onChange={(e) => setStatePrimary(e.target.value)}
                className={inputClass}>
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="Inflation Rate (%)">
              <input type="number" min="0" max="20" step="0.1" value={inflationRate}
                onChange={(e) => setInflationRate(e.target.value)}
                className={inputClass} placeholder="2.5" />
            </Field>
            <Field label="Risk Tolerance">
              <select value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value)} className={inputClass}>
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </Field>
            <Field label="Growth Rate – Accumulation (%)">
              <input type="number" min="-10" max="30" step="0.5" value={growthRateAccumulation}
                onChange={(e) => setGrowthRateAccumulation(e.target.value)}
                className={inputClass} placeholder="7" />
            </Field>
            <Field label="Growth Rate – Retirement (%)">
              <input type="number" min="-10" max="30" step="0.5" value={growthRateRetirement}
                onChange={(e) => setGrowthRateRetirement(e.target.value)}
                className={inputClass} placeholder="5" />
            </Field>
            <Field label="Tax Deduction Method">
              <div className="flex gap-2 mt-1">
                {(['standard', 'custom', 'none'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDeductionMode(mode)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition capitalize ${
                      deductionMode === mode
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </Field>
            {deductionMode === 'custom' && (
              <Field label="Custom Deduction Amount ($)">
                <input
                  type="text"
                  inputMode="numeric"
                  value={customDeductionAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '')
                    setCustomDeductionAmount(val)
                  }}
                  className={inputClass}
                  placeholder="e.g. 25000"
                />
              </Field>
            )}
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}

        {success && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            Profile saved! Redirecting to dashboard...
          </p>
        )}

        <button type="submit" disabled={isSubmitting}
          className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
          {isSubmitting ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  )
}

const inputClass = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
