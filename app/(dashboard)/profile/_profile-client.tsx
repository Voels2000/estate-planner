'use client'

// ─────────────────────────────────────────
// Menu: Profile
// Route: /profile
// ─────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ProfileSavePayload } from '@/lib/profile/buildHouseholdPayload'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass, formLabelClass } from '@/components/ui/form'
import { FILING_STATUSES, type ProfileFormInitial } from '@/lib/profile/profileFormInitial'
import { isMinimumViableProfile, type ProfileGateHousehold, type ProfileGateMissingField } from '@/lib/estate/profileGate'
import { ProfileRequiredBanner } from './_profile-required-banner'

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

type ProfileClientProps = {
  initial: ProfileFormInitial
  fromParam: string | null
  requiredParam?: boolean
  missingFields?: ProfileGateMissingField[]
  householdSnapshot?: ProfileGateHousehold
}

export function ProfileClient({
  initial,
  fromParam,
  requiredParam = false,
  missingFields = [],
  householdSnapshot,
}: ProfileClientProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [success, setSuccess] = useState(false)
  const [householdId, setHouseholdId] = useState<string | null>(initial.householdId)

  const [fullName, setFullName] = useState(initial.fullName)
  const [email, setEmail] = useState(initial.email)

  const [householdName, setHouseholdName] = useState(initial.householdName)
  const [person1Name, setPerson1Name] = useState(initial.person1Name)
  const [person1BirthYear, setPerson1BirthYear] = useState(initial.person1BirthYear)
  const [person1RetirementAge, setPerson1RetirementAge] = useState(initial.person1RetirementAge)
  const [person1SSClaimingAge, setPerson1SSClaimingAge] = useState(initial.person1SSClaimingAge)
  const [person1LongevityAge, setPerson1LongevityAge] = useState(initial.person1LongevityAge)
  const [person1SSPia, setPerson1SSPia] = useState(initial.person1SSPia)

  const [hasSpouse, setHasSpouse] = useState(initial.hasSpouse)
  const [person2Name, setPerson2Name] = useState(initial.person2Name)
  const [person2BirthYear, setPerson2BirthYear] = useState(initial.person2BirthYear)
  const [person2RetirementAge, setPerson2RetirementAge] = useState(initial.person2RetirementAge)
  const [person2SSClaimingAge, setPerson2SSClaimingAge] = useState(initial.person2SSClaimingAge)
  const [person2LongevityAge, setPerson2LongevityAge] = useState(initial.person2LongevityAge)
  const [person2SSPia, setPerson2SSPia] = useState(initial.person2SSPia)

  const [filingStatus, setFilingStatus] = useState(initial.filingStatus)
  const [statePrimary, setStatePrimary] = useState(initial.statePrimary)
  const [stateCompare, setStateCompare] = useState(initial.stateCompare)
  const [inflationRate, setInflationRate] = useState(initial.inflationRate)
  const [riskTolerance, setRiskTolerance] = useState(initial.riskTolerance)
  const [growthRateAccumulation, setGrowthRateAccumulation] = useState(initial.growthRateAccumulation)
  const [growthRateRetirement, setGrowthRateRetirement] = useState(initial.growthRateRetirement)
  const [deductionMode, setDeductionMode] = useState<'standard' | 'custom' | 'none'>(initial.deductionMode)
  const [customDeductionAmount, setCustomDeductionAmount] = useState(initial.customDeductionAmount)

  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false)
  const [welcomeContext, setWelcomeContext] = useState<
    'assessment' | 'advisor' | 'attorney' | 'general' | null
  >(null)

  useEffect(() => {
    const pending = (() => {
      try { return localStorage.getItem('mwm_pending_assessment') } catch { return null }
    })()
    const from = fromParam || ''

    if (pending) {
      setWelcomeContext('assessment')
      setShowWelcomeBanner(true)
    } else if (from === 'find-advisor') {
      setWelcomeContext('advisor')
      setShowWelcomeBanner(true)
    } else if (from === 'find-attorney') {
      setWelcomeContext('attorney')
      setShowWelcomeBanner(true)
    }
  }, [fromParam])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsSubmitting(true)

    const errors: string[] = []
    if (!person1Name.trim()) errors.push('Your name is required')
    if (!person1BirthYear) errors.push('Your birth year is required')
    if (!person1RetirementAge) errors.push('Your retirement age is required')
    if (!person1SSClaimingAge) errors.push('Your Social Security claiming age is required')
    if (!person1LongevityAge) errors.push('Your longevity age is required')
    if (hasSpouse) {
      if (!person2Name.trim()) errors.push('Spouse name is required')
      if (!person2BirthYear) errors.push('Spouse birth year is required')
      if (!person2RetirementAge) errors.push('Spouse retirement age is required')
      if (!person2SSClaimingAge) errors.push('Spouse Social Security claiming age is required')
      if (!person2LongevityAge) errors.push('Spouse longevity age is required')
    }
    if (errors.length > 0) {
      setValidationErrors(errors)
      setIsSubmitting(false)
      return
    }
    setValidationErrors([])

    try {
      const payload: ProfileSavePayload = {
        householdId,
        fullName,
        email,
        householdName,
        person1Name,
        person1BirthYear,
        person1RetirementAge,
        person1SSClaimingAge,
        person1LongevityAge,
        person1SSPia,
        hasSpouse,
        person2Name,
        person2BirthYear,
        person2RetirementAge,
        person2SSClaimingAge,
        person2LongevityAge,
        person2SSPia,
        filingStatus,
        statePrimary,
        stateCompare,
        inflationRate,
        riskTolerance,
        growthRateAccumulation,
        growthRateRetirement,
        deductionMode,
        customDeductionAmount,
      }

      const res = await fetch('/api/consumer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save profile')
      }

      const { householdId: savedHouseholdId, created } = (await res.json()) as {
        householdId: string
        created: boolean
      }

      if (created && savedHouseholdId) {
        setHouseholdId(savedHouseholdId)
      }

      setSuccess(true)
      setIsSubmitting(false)

      const gateHousehold: ProfileGateHousehold = {
        state_primary: statePrimary || null,
        filing_status: filingStatus || null,
        person1_birth_year: person1BirthYear ? Number(person1BirthYear) : null,
      }
      const profileComplete = isMinimumViableProfile(gateHousehold).complete
      const returnTo =
        requiredParam && profileComplete && fromParam?.startsWith('/')
          ? fromParam
          : householdId || created
            ? '/dashboard'
            : '/health-check'

      setTimeout(() => {
        router.push(returnTo)
        router.refresh()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {showWelcomeBanner && (
        <div style={{
          background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3460 100%)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 24,
          border: '1px solid rgba(201,168,76,0.3)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
              color: '#c9a84c', textTransform: 'uppercase', marginBottom: 6 }}>
              Welcome to My Wealth Maps
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'white', marginBottom: 4,
              fontFamily: 'Playfair Display, Georgia, serif' }}>
              {welcomeContext === 'assessment' && 'Your assessment results are being saved.'}
              {welcomeContext === 'advisor' && 'Ready to connect with an advisor.'}
              {welcomeContext === 'attorney' && 'Ready to connect with an attorney.'}
              {welcomeContext === 'general' && 'Your account is ready.'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              {welcomeContext === 'assessment' && (
                <>Complete your profile, then <a href="/assess" style={{ color: '#c9a84c' }}>view your assessment results</a> on the assessment page.</>
              )}
              {welcomeContext === 'advisor' && (
                <>Complete your profile, then <a href="/find-advisor" style={{ color: '#c9a84c' }}>return to the advisor directory</a> to send your connection request.</>
              )}
              {welcomeContext === 'attorney' && (
                <>Complete your profile, then <a href="/find-attorney" style={{ color: '#c9a84c' }}>return to the attorney directory</a> to send your connection request.</>
              )}
            </div>
          </div>
          <button onClick={() => setShowWelcomeBanner(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', fontSize: 18, padding: 0, flexShrink: 0 }}>
            ✕
          </button>
        </div>
      )}
      {requiredParam && householdSnapshot && (
        <ProfileRequiredBanner
          missingFromUrl={missingFields}
          householdSnapshot={{
            ...householdSnapshot,
            state_primary: statePrimary || null,
            filing_status: filingStatus || null,
            person1_birth_year: person1BirthYear ? Number(person1BirthYear) : null,
          }}
        />
      )}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Your Profile</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Complete your household information for accurate projections.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        <Card className="rounded-2xl p-6">
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
        </Card>

        <Card className="rounded-2xl p-6">
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
              <input
                id="profile-field-person1-birth-year"
                type="number"
                min="1920"
                max="2005"
                required
                value={person1BirthYear}
                onChange={(e) => setPerson1BirthYear(e.target.value)}
                className={inputClass}
                placeholder="1970"
              />
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
            <div>
              <label className={`${formLabelClass} mb-1 block`}>
                Your Monthly SS Benefit at Full Retirement Age (PIA)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400">$</span>
                <input
                  type="number"
                  min="0"
                  value={person1SSPia}
                  onChange={(e) => setPerson1SSPia(e.target.value)}
                  className={`${formControlClass} pl-7`}
                  placeholder="e.g. 2400"
                />
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Enter your PIA — the monthly amount you&apos;d receive if you claim at your Full Retirement Age.
                Find this on your Social Security statement at ssa.gov/myaccount.
                The projection adjusts this amount based on your chosen claiming age.
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl p-6">
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
              <div>
                <label className={`${formLabelClass} mb-1 block`}>
                  Spouse Monthly SS Benefit at Full Retirement Age (PIA)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-neutral-400">$</span>
                  <input
                    type="number"
                    min="0"
                    value={person2SSPia}
                    onChange={(e) => setPerson2SSPia(e.target.value)}
                    className={`${formControlClass} pl-7`}
                    placeholder="e.g. 1800"
                  />
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Spouse&apos;s PIA — the monthly amount at their Full Retirement Age.
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card className="rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Tax &amp; Location
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Filing Status">
              <select
                id="profile-field-filing-status"
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
              <select
                id="profile-field-state-primary"
                value={statePrimary}
                onChange={(e) => setStatePrimary(e.target.value)}
                className={inputClass}
              >
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
              <p className="mt-1 text-xs text-neutral-400">
                Applied to financial assets before retirement. Reflects a longer time horizon and typically higher equity allocation.
              </p>
            </Field>
            <Field label="Growth Rate – Retirement (%)">
              <input type="number" min="-10" max="30" step="0.5" value={growthRateRetirement}
                onChange={(e) => setGrowthRateRetirement(e.target.value)}
                className={inputClass} placeholder="5" />
              <p className="mt-1 text-xs text-neutral-400">
                Applied to financial assets after retirement begins. Reflects a more conservative allocation to manage withdrawal risk.
              </p>
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
                        ? 'bg-indigo-600 text-white shadow-sm'
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
        </Card>

        {validationErrors.length > 0 && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
            <p className="font-medium">Please complete the following before saving:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {validationErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}

        {success && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            Profile saved! Redirecting to dashboard...
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="w-full rounded-lg py-3 text-sm font-medium"
        >
          {isSubmitting ? 'Saving...' : 'Save Profile'}
        </Button>
      </form>
    </div>
  )
}

const inputClass = formControlClass

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  return (
    <div>
      <label className={`${formLabelClass} mb-1 block`}>
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
