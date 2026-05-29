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
import { consumeIntakeToken } from '@/lib/attorney/intakeTokenSession'
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
  onboardingPersona?: string | null
}

export function ProfileClient({
  initial,
  fromParam,
  requiredParam = false,
  missingFields = [],
  householdSnapshot,
  onboardingPersona = null,
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
  const [deductionMode, setDeductionMode] = useState<'standard' | 'custom' | 'none'>(initial.deductionMode)
  const [customDeductionAmount, setCustomDeductionAmount] = useState(initial.customDeductionAmount)
  const [grossEstateEstimate, setGrossEstateEstimate] = useState(initial.grossEstateEstimate)
  const [hasMinorChildren, setHasMinorChildren] = useState<boolean | null>(initial.hasMinorChildren)
  const [hasBusinessInterests, setHasBusinessInterests] = useState<boolean | null>(
    initial.hasBusinessInterests,
  )
  const showWizardFields = initial.showWizardFields

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
    if (!statePrimary.trim()) errors.push('Primary state is required')
    if (!filingStatus.trim()) errors.push('Filing status is required')
    if (hasSpouse) {
      if (!person2Name.trim()) errors.push('Spouse name is required')
      if (!person2BirthYear) errors.push('Spouse birth year is required')
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
        deductionMode,
        customDeductionAmount,
        grossEstateEstimate,
        hasMinorChildren,
        hasBusinessInterests,
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

      const intakeToken = consumeIntakeToken()
      if (intakeToken) {
        void fetch('/api/consumer/complete-intake-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intakeToken }),
        }).catch(() => {})
      }

      setSuccess(true)
      setIsSubmitting(false)

      const gateHousehold: ProfileGateHousehold = {
        person1_name: person1Name || null,
        state_primary: statePrimary || null,
        filing_status: filingStatus || null,
        person1_birth_year: person1BirthYear ? Number(person1BirthYear) : null,
      }
      const profileComplete = isMinimumViableProfile(gateHousehold).complete
      const returnTo =
        requiredParam && profileComplete && fromParam?.startsWith('/')
          ? fromParam
          : profileComplete && (householdId || created)
            ? showWizardFields
              ? onboardingPersona
                ? '/onboarding/wizard'
                : '/onboarding/persona'
              : '/onboarding/invite-advisor'
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
          background: 'linear-gradient(135deg, #0f1f3d 0%, var(--mwm-navy-light) 100%)',
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
            person1_name: person1Name || null,
            state_primary: statePrimary || null,
            filing_status: filingStatus || null,
            person1_birth_year: person1BirthYear ? Number(person1BirthYear) : null,
          }}
        />
      )}
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold text-[#0F1B3C]">Your Profile</h1>
        <p className="text-sm text-gray-500">
          A few essentials to personalize your dashboard — you can add planning details later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {showWizardFields && (
          <div className="mb-8 rounded-[var(--mwm-radius)] border border-[color:var(--mwm-gold)] bg-[var(--mwm-gold-pale)] p-6">
            <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-medium text-[color:var(--mwm-navy)]">
              Your profile is the foundation
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-[color:var(--mwm-text-secondary)]">
              Your state, filing status, and household details power every calculation on this
              platform — estate tax exposure, retirement projections, and planning gap detection.
              This takes about 2 minutes.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 font-semibold text-[color:var(--mwm-gold)]">1</span>
                <div>
                  <p className="text-sm font-medium text-[color:var(--mwm-navy)]">Financial picture</p>
                  <p className="text-xs text-[color:var(--mwm-text-muted)]">
                    Net worth, income, projections
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 font-semibold text-[color:var(--mwm-gold)]">2</span>
                <div>
                  <p className="text-sm font-medium text-[color:var(--mwm-navy)]">Retirement planning</p>
                  <p className="text-xs text-[color:var(--mwm-text-muted)]">
                    Social Security, RMDs, Monte Carlo
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 font-semibold text-[color:var(--mwm-gold)]">3</span>
                <div>
                  <p className="text-sm font-medium text-[color:var(--mwm-navy)]">Estate planning</p>
                  <p className="text-xs text-[color:var(--mwm-text-muted)]">
                    Tax exposure, conflict detection, strategies
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <Card className="rounded-2xl p-6">
          <ProfileSectionHeader>Household</ProfileSectionHeader>
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

        <div className="space-y-4">
          <div
            className={`grid gap-4 ${
              hasSpouse ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <ProfileSectionHeader>
                {person1Name.trim() || 'You'}
              </ProfileSectionHeader>
              <div className="space-y-4">
                <Field label="Your Name" required>
                  <input
                    id="profile-field-person1-name"
                    type="text"
                    required
                    value={person1Name}
                    onChange={(e) => setPerson1Name(e.target.value)}
                    className={inputClass}
                    placeholder="Jane"
                  />
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
              </div>
            </div>

            {hasSpouse && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <ProfileSectionHeader>
                  {person2Name.trim() || 'Spouse / Partner'}
                </ProfileSectionHeader>
                <div className="space-y-4">
                  <Field label="Spouse Name" required>
                    <input
                      type="text"
                      required
                      value={person2Name}
                      onChange={(e) => setPerson2Name(e.target.value)}
                      className={inputClass}
                      placeholder="John"
                    />
                  </Field>
                  <Field label="Spouse Birth Year" required>
                    <input
                      type="number"
                      min="1920"
                      max="2005"
                      required
                      value={person2BirthYear}
                      onChange={(e) => setPerson2BirthYear(e.target.value)}
                      className={inputClass}
                      placeholder="1968"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-1">
            <input
              id="hasSpouse"
              type="checkbox"
              checked={hasSpouse}
              onChange={(e) => setHasSpouse(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-[#0F1B3C]"
            />
            <label htmlFor="hasSpouse" className="cursor-pointer text-sm text-gray-700">
              Include spouse / partner
            </label>
          </div>
        </div>

        <Card className="rounded-2xl p-6">
          <ProfileSectionHeader>Household Planning</ProfileSectionHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Filing Status" required>
                <select
                  id="profile-field-filing-status"
                  required
                  value={filingStatus}
                  onChange={(e) => setFilingStatus(e.target.value)}
                  className={inputClass}
                >
                  {FILING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {FILING_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Primary State" required>
                <select
                  id="profile-field-state-primary"
                  required
                  value={statePrimary}
                  onChange={(e) => setStatePrimary(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-gray-600">
                Additional planning settings
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">
                    Growth rates, real estate &amp; business assumptions
                  </span>
                  <a
                    href="/scenarios"
                    className="shrink-0 text-xs font-medium text-[#0F1B3C] transition-colors hover:text-[#C9A84C]"
                  >
                    Scenarios →
                  </a>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">
                    Risk tolerance &amp; target asset allocation
                  </span>
                  <a
                    href="/allocation"
                    className="shrink-0 text-xs font-medium text-[#0F1B3C] transition-colors hover:text-[#C9A84C]"
                  >
                    Asset Allocation →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {showWizardFields && (
          <Card className="rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
              A little more about your household
            </h2>
            <Field label="Estimated household net worth">
              <select
                value={grossEstateEstimate}
                onChange={(e) => setGrossEstateEstimate(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a range</option>
                <option value="under_2m">Under $2M</option>
                <option value="2m_5m">$2M – $5M</option>
                <option value="5m_10m">$5M – $10M</option>
                <option value="10m_20m">$10M – $20M</option>
                <option value="over_20m">Over $20M</option>
              </select>
            </Field>
            <div className="mt-4 space-y-4">
              <BooleanToggle
                label="Do you have children under 18?"
                value={hasMinorChildren}
                onChange={setHasMinorChildren}
              />
              <BooleanToggle
                label="Do you own a business interest?"
                value={hasBusinessInterests}
                onChange={setHasBusinessInterests}
              />
            </div>
          </Card>
        )}

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
          className="mt-6 w-full rounded-lg py-3 text-sm font-semibold"
        >
          {isSubmitting ? 'Saving...' : 'Save Profile'}
        </Button>
      </form>
    </div>
  )
}

const inputClass = formControlClass

function ProfileSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 border-l-4 border-[#C9A84C] pl-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{children}</p>
    </div>
  )
}

function BooleanToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div>
      <p className={`${formLabelClass} mb-2`}>{label}</p>
      <div className="flex gap-2">
        {(['yes', 'no'] as const).map((choice) => {
          const selected = choice === 'yes' ? value === true : value === false
          return (
            <button
              key={choice}
              type="button"
              onClick={() => onChange(choice === 'yes')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition capitalize ${
                selected
                  ? 'bg-[var(--mwm-navy)] text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {choice}
            </button>
          )
        })}
      </div>
    </div>
  )
}

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
