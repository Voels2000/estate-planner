'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { captureFunnelEvent } from '@/lib/analytics/useFunnelEvent'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass, formLabelClass } from '@/components/ui/form'
import type { SetupProgressCounts } from '@/lib/consumer/setupProgressCounts'
import type { PersonaConfig } from '@/lib/onboarding/personaConfig'
import { cn } from '@/lib/utils'

type RefOption = { value: string; label: string }
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

const WIZARD_STEPS: WizardStep[] = [1, 2, 3, 4, 5, 6]

type Props = {
  person1Label: string
  person2Label: string
  hasSpouse: boolean
  assetTypes: RefOption[]
  incomeTypes: RefOption[]
  inviteMailto: string
  personaConfig: PersonaConfig
}

type WizardStepPreview = {
  title: string
  items: string[]
  footer: string
}

const PREVIEW_BY_STEP: Record<WizardStep, WizardStepPreview> = {
  1: {
    title: 'What adding your first asset unlocks',
    items: [
      'Your net worth — calculated from assets minus liabilities',
      "Account titling gaps — we'll flag assets that may cause probate issues",
      'Estate composition — how your assets are classified for tax purposes',
    ],
    footer:
      'A financial advisor can help you interpret your net worth picture and identify early planning opportunities.',
  },
  2: {
    title: 'What adding income unlocks',
    items: [
      'Retirement trajectory — projection of your income through retirement',
      'Cash flow picture — income vs expenses over time',
      'Tax estimate — basic federal and state income tax modeling',
    ],
    footer:
      "A financial advisor or CPA can validate your assumptions and help you act on what you're seeing.",
  },
  3: {
    title: 'What adding liabilities unlocks',
    items: [
      'True net worth — assets minus what you owe',
      'Accurate estate tax calculations',
      'Debt-to-asset ratio for advisor conversations',
    ],
    footer:
      'Most estates have mortgages, business loans, or personal debt — including them gives you the real picture.',
  },
  4: {
    title: 'What adding expenses unlocks',
    items: [
      'Cash flow projection — income vs. spending over time',
      'Retirement runway — how long your money lasts',
      'Gap analysis for estate and retirement planning',
    ],
    footer:
      'Expenses are the missing half of the income picture. Your advisor needs both to model your retirement accurately.',
  },
  5: {
    title: 'What adding insurance unlocks',
    items: [
      'Estate liquidity analysis — can your heirs cover taxes and costs?',
      'Coverage gap detection — under- or over-insured alerts',
      'Life insurance in your estate tax calculation',
    ],
    footer:
      'Life insurance is often the largest non-investment asset in an estate. It changes the tax picture significantly.',
  },
  6: {
    title: 'Why connecting your advisor matters',
    items: [
      'Live access to your complete financial picture',
      'Strategy recommendations based on your actual data',
      'Better, faster conversations — no more re-explaining',
    ],
    footer:
      'At the $2M–$30M level, a coordinated advisor relationship is the single highest-ROI estate planning decision.',
  },
}

function firstIncompleteStep(progress: SetupProgressCounts): WizardStep {
  if (progress.assets <= 0) return 1
  if (progress.income <= 0) return 2
  if (progress.liabilities <= 0) return 3
  if (progress.expenses <= 0) return 4
  if (progress.insurance <= 0) return 5
  return 6
}

export function OnboardingWizardClient({
  person1Label,
  person2Label,
  hasSpouse,
  assetTypes,
  incomeTypes,
  inviteMailto,
  personaConfig,
}: Props) {
  const router = useRouter()
  const wizardCompletedRef = useRef(false)
  const stepRef = useRef<WizardStep>(1)
  const [step, setStep] = useState<WizardStep>(1)
  stepRef.current = step
  const [progress, setProgress] = useState<SetupProgressCounts | null>(null)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [advisorStepDone, setAdvisorStepDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const refreshProgress = useCallback(async () => {
    const res = await fetch('/api/consumer/setup-progress')
    if (!res.ok) return null
    const data = (await res.json()) as SetupProgressCounts
    setProgress(data)
    return data
  }, [])

  useEffect(() => {
    void (async () => {
      const data = await refreshProgress()
      setProgressLoaded(true)
      if (!data) return
      setStep(firstIncompleteStep(data))
    })()
  }, [refreshProgress, router])

  useEffect(() => {
    return () => {
      if (!wizardCompletedRef.current) {
        captureFunnelEvent({
          event_name: 'wizard_abandoned',
          properties: { step: stepRef.current, reason: 'navigate_away' },
        })
      }
    }
  }, [])

  const sortedAssetTypes = [...assetTypes].sort((a, b) => a.label.localeCompare(b.label))
  const defaultPersonaAssetType =
    sortedAssetTypes.find((t) => t.value === personaConfig.firstAssetType)?.value ??
    sortedAssetTypes[0]?.value ??
    ''
  const sortedIncomeTypes = [...incomeTypes].sort((a, b) => a.label.localeCompare(b.label))
  const defaultIncomeType =
    sortedIncomeTypes.find((t) => t.value === 'salary')?.value ??
    sortedIncomeTypes[0]?.value ??
    'salary'

  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState(defaultPersonaAssetType)
  const [assetValue, setAssetValue] = useState('')
  const [assetOwner, setAssetOwner] = useState('person1')
  const [step1View, setStep1View] = useState<'fork' | 'manual'>('fork')

  const [incomeName, setIncomeName] = useState('')
  const [incomeSource, setIncomeSource] = useState(defaultIncomeType)
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeOwner, setIncomeOwner] = useState('person1')

  const [liabilityName, setLiabilityName] = useState('')
  const [liabilityType, setLiabilityType] = useState('mortgage')
  const [liabilityBalance, setLiabilityBalance] = useState('')

  const [expenseCategory, setExpenseCategory] = useState('housing')
  const [expenseAmount, setExpenseAmount] = useState('')

  const [insuranceType, setInsuranceType] = useState('term_life')
  const [insuranceDeathBenefit, setInsuranceDeathBenefit] = useState('')
  const [insuranceAnnualPremium, setInsuranceAnnualPremium] = useState('')

  const currentYear = new Date().getFullYear()

  const stepComplete = (n: WizardStep) => {
    if (!progress) return false
    if (n === 1) return progress.assets > 0
    if (n === 2) return progress.income > 0
    if (n === 3) return progress.liabilities > 0
    if (n === 4) return progress.expenses > 0
    if (n === 5) return progress.insurance > 0
    return advisorStepDone
  }

  async function completeWizard() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/onboarding-wizard-complete', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to complete setup')
      }
      wizardCompletedRef.current = true
      captureFunnelEvent({
        event_name: 'wizard_completed',
        properties: { step },
      })
      setAdvisorStepDone(true)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  async function saveAsset() {
    if (!assetType || !assetName.trim() || !assetValue) {
      setError('Asset name, type, and value are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assetName.trim(),
          type: assetType,
          value: Number(assetValue),
          owner: assetOwner,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save asset')
      }
      await refreshProgress()
      setStep(2)
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save asset')
      setSubmitting(false)
    }
  }

  async function saveIncome() {
    if (!incomeSource || !incomeName.trim() || !incomeAmount) {
      setError('Source, name, and annual amount are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: incomeSource,
          name: incomeName.trim(),
          amount: Number(incomeAmount),
          start_year: currentYear,
          ss_person: incomeOwner,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save income')
      }
      await refreshProgress()
      setStep(3)
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save income')
      setSubmitting(false)
    }
  }

  async function saveLiability() {
    if (!liabilityType || !liabilityBalance) {
      setError('Type and outstanding balance are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/liabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: liabilityType,
          name: liabilityName.trim() || null,
          balance: Number(liabilityBalance),
          owner: 'person1',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save liability')
      }
      await refreshProgress()
      setStep(4)
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save liability')
      setSubmitting(false)
    }
  }

  async function saveExpense() {
    if (!expenseCategory || !expenseAmount) {
      setError('Category and annual amount are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseCategory,
          amount: Number(expenseAmount),
          start_year: currentYear,
          owner: 'person1',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save expense')
      }
      await refreshProgress()
      setStep(5)
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense')
      setSubmitting(false)
    }
  }

  async function saveInsurance() {
    if (!insuranceType || !insuranceDeathBenefit) {
      setError('Policy type and death benefit are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insurance_type: insuranceType,
          death_benefit: Number(insuranceDeathBenefit),
          annual_premium: insuranceAnnualPremium ? Number(insuranceAnnualPremium) : null,
          owner: 'person1',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save insurance policy')
      }
      await refreshProgress()
      setStep(6)
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save insurance policy')
      setSubmitting(false)
    }
  }

  function handleInviteAdvisor() {
    window.location.href = inviteMailto
    void completeWizard()
  }

  function skipOptionalStep(next: WizardStep) {
    captureFunnelEvent({
      event_name: 'wizard_abandoned',
      properties: { step, reason: 'skip' },
    })
    setError(null)
    setStep(next)
  }

  const ownerOptions = [
    { value: 'person1', label: person1Label },
    ...(hasSpouse ? [{ value: 'person2', label: person2Label }] : []),
    ...(step === 1 && hasSpouse ? [{ value: 'joint', label: 'Joint' }] : []),
  ]

  if (!progressLoaded) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--mwm-off-white)]">
        <p className="text-sm text-[color:var(--mwm-text-muted)]">Loading your progress…</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--mwm-off-white)]">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-10 lg:flex-row lg:items-start lg:gap-10 lg:py-16">
        <div className="w-full max-w-[560px] flex-1">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                captureFunnelEvent({
                  event_name: 'wizard_abandoned',
                  properties: { step, reason: 'back_to_dashboard' },
                })
                wizardCompletedRef.current = true
                router.push('/dashboard')
              }}
              className="text-xs text-[color:var(--mwm-text-muted)] underline-offset-2 hover:text-[color:var(--mwm-navy)] hover:underline"
            >
              ← Back to dashboard
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
            {WIZARD_STEPS.map((n) => (
              <div key={n} className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setStep(n)}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    stepComplete(n)
                      ? 'bg-[var(--mwm-sage)] text-white'
                      : step === n
                        ? 'bg-[var(--mwm-navy)] text-white'
                        : 'bg-[var(--mwm-border)] text-[color:var(--mwm-text-muted)]',
                  )}
                  aria-label={`Step ${n}`}
                >
                  {stepComplete(n) ? '✓' : n}
                </button>
                {n < 6 && (
                  <div
                    className={cn(
                      'h-px w-4 sm:w-6',
                      stepComplete(n) ? 'bg-[var(--mwm-sage)]' : 'bg-[var(--mwm-border)]',
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          <Card className="mt-6 shadow-[var(--mwm-shadow)]">
            {step === 1 && step1View === 'fork' && (
              <>
                <Card.Header>
                  <h1 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--mwm-navy)]">
                    {personaConfig.wizardStep1Headline}
                  </h1>
                  <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
                    {personaConfig.wizardStep1Body}
                  </p>
                </Card.Header>
                <Card.Body className="space-y-6">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => {
                      captureFunnelEvent({
                        event_name: 'wizard_import_cta',
                        properties: { step: 1 },
                      })
                      router.push('/import?onboarding=true')
                    }}
                  >
                    Upload a spreadsheet
                  </Button>
                  <p className="text-center text-xs text-[color:var(--mwm-text-muted)]">
                    Recommended for you:{' '}
                    <a
                      href={`/templates/${personaConfig.importTemplateName}`}
                      className="font-medium text-[color:var(--mwm-navy)] underline underline-offset-2"
                      download
                    >
                      {personaConfig.importTemplateName}
                    </a>{' '}
                    · Download template →
                  </p>
                  <div className="relative text-center">
                    <span className="bg-white px-3 text-xs text-[color:var(--mwm-text-muted)] relative z-10">
                      or
                    </span>
                    <div className="absolute inset-x-0 top-1/2 border-t border-[var(--mwm-border)]" />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      captureFunnelEvent({
                        event_name: 'wizard_manual_asset_cta',
                        properties: { step: 1 },
                      })
                      setAssetType(defaultPersonaAssetType)
                      setStep1View('manual')
                    }}
                  >
                    Add {personaConfig.firstAssetLabel.toLowerCase()} →
                  </Button>
                </Card.Body>
              </>
            )}

            {step === 1 && step1View === 'manual' && (
              <>
                <Card.Header>
                  <h1 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--mwm-navy)]">
                    {personaConfig.wizardStep1Headline}
                  </h1>
                  <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
                    {personaConfig.wizardStep1Body}
                  </p>
                </Card.Header>
                <Card.Body className="space-y-4">
                  <WizardField label={personaConfig.firstAssetLabel}>
                    <input
                      type="text"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      className={formControlClass}
                      placeholder={personaConfig.firstAssetPlaceholder}
                    />
                  </WizardField>
                  <WizardField label="Asset type">
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value)}
                      className={formControlClass}
                    >
                      {sortedAssetTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </WizardField>
                  <WizardField label="Estimated value">
                    <input
                      type="number"
                      min="0"
                      value={assetValue}
                      onChange={(e) => setAssetValue(e.target.value)}
                      className={formControlClass}
                      placeholder="500000"
                    />
                  </WizardField>
                  <WizardField label="Owner">
                    <select
                      value={assetOwner}
                      onChange={(e) => setAssetOwner(e.target.value)}
                      className={formControlClass}
                    >
                      {ownerOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </WizardField>
                </Card.Body>
              </>
            )}

            {step === 2 && (
              <>
                <Card.Header>
                  <h1 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--mwm-navy)]">
                    What&apos;s your primary source of income?
                  </h1>
                  <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
                    We use this to model your retirement trajectory and tax picture.
                  </p>
                </Card.Header>
                <Card.Body className="space-y-4">
                  <WizardField label="Employer or source">
                    <input
                      type="text"
                      value={incomeName}
                      onChange={(e) => setIncomeName(e.target.value)}
                      className={formControlClass}
                      placeholder="Acme Corp"
                    />
                  </WizardField>
                  <WizardField label="Income type">
                    <select
                      value={incomeSource}
                      onChange={(e) => setIncomeSource(e.target.value)}
                      className={formControlClass}
                    >
                      {sortedIncomeTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </WizardField>
                  <WizardField label="Annual amount">
                    <input
                      type="number"
                      min="0"
                      value={incomeAmount}
                      onChange={(e) => setIncomeAmount(e.target.value)}
                      className={formControlClass}
                      placeholder="150000"
                    />
                  </WizardField>
                  <WizardField label="Owner">
                    <select
                      value={incomeOwner}
                      onChange={(e) => setIncomeOwner(e.target.value)}
                      className={formControlClass}
                    >
                      {ownerOptions
                        .filter((o) => o.value !== 'joint')
                        .map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                    </select>
                  </WizardField>
                </Card.Body>
              </>
            )}

            {step === 3 && (
              <>
                <Card.Header>
                  <h1 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--mwm-navy)]">
                    What do you owe?
                  </h1>
                  <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
                    Add your largest liability first — a mortgage, business loan, or line of credit.
                  </p>
                </Card.Header>
                <Card.Body className="space-y-4">
                  <WizardField label="Name">
                    <input
                      type="text"
                      value={liabilityName}
                      onChange={(e) => setLiabilityName(e.target.value)}
                      className={formControlClass}
                      placeholder="Primary mortgage"
                    />
                  </WizardField>
                  <WizardField label="Type">
                    <select
                      value={liabilityType}
                      onChange={(e) => setLiabilityType(e.target.value)}
                      className={formControlClass}
                    >
                      <option value="mortgage">Mortgage</option>
                      <option value="auto_loan">Auto loan</option>
                      <option value="student_loan">Student loan</option>
                      <option value="business_loan">Business loan</option>
                      <option value="line_of_credit">Line of credit</option>
                      <option value="other">Other</option>
                    </select>
                  </WizardField>
                  <WizardField label="Outstanding balance">
                    <input
                      type="number"
                      min="0"
                      value={liabilityBalance}
                      onChange={(e) => setLiabilityBalance(e.target.value)}
                      className={formControlClass}
                      placeholder="0"
                    />
                  </WizardField>
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-xs text-[color:var(--mwm-text-secondary)] underline-offset-2 hover:text-[color:var(--mwm-navy)] hover:underline"
                      onClick={() => skipOptionalStep(4)}
                    >
                      Skip for now
                    </button>
                  </div>
                </Card.Body>
              </>
            )}

            {step === 4 && (
              <>
                <Card.Header>
                  <h1 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--mwm-navy)]">
                    What are your largest expenses?
                  </h1>
                  <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
                    Add your largest monthly expense category — housing is a good starting point.
                  </p>
                </Card.Header>
                <Card.Body className="space-y-4">
                  <WizardField label="Category">
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className={formControlClass}
                    >
                      <option value="housing">Housing</option>
                      <option value="transportation">Transportation</option>
                      <option value="food">Food &amp; dining</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="insurance">Insurance premiums</option>
                      <option value="education">Education</option>
                      <option value="entertainment">Entertainment</option>
                      <option value="other">Other</option>
                    </select>
                  </WizardField>
                  <WizardField label="Annual amount">
                    <input
                      type="number"
                      min="0"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className={formControlClass}
                      placeholder="0"
                    />
                  </WizardField>
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-xs text-[color:var(--mwm-text-secondary)] underline-offset-2 hover:text-[color:var(--mwm-navy)] hover:underline"
                      onClick={() => skipOptionalStep(5)}
                    >
                      Skip for now
                    </button>
                  </div>
                </Card.Body>
              </>
            )}

            {step === 5 && (
              <>
                <Card.Header>
                  <h1 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--mwm-navy)]">
                    Life insurance
                  </h1>
                  <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
                    Add your primary life insurance policy. This changes your estate picture
                    significantly.
                  </p>
                </Card.Header>
                <Card.Body className="space-y-4">
                  <WizardField label="Policy type">
                    <select
                      value={insuranceType}
                      onChange={(e) => setInsuranceType(e.target.value)}
                      className={formControlClass}
                    >
                      <option value="term_life">Term life</option>
                      <option value="whole_life">Whole life</option>
                      <option value="universal_life">Universal life</option>
                      <option value="variable_life">Variable life</option>
                    </select>
                  </WizardField>
                  <WizardField label="Death benefit">
                    <input
                      type="number"
                      min="0"
                      value={insuranceDeathBenefit}
                      onChange={(e) => setInsuranceDeathBenefit(e.target.value)}
                      className={formControlClass}
                      placeholder="0"
                    />
                  </WizardField>
                  <WizardField label="Annual premium">
                    <input
                      type="number"
                      min="0"
                      value={insuranceAnnualPremium}
                      onChange={(e) => setInsuranceAnnualPremium(e.target.value)}
                      className={formControlClass}
                      placeholder="0"
                    />
                  </WizardField>
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-xs text-[color:var(--mwm-text-secondary)] underline-offset-2 hover:text-[color:var(--mwm-navy)] hover:underline"
                      onClick={() => skipOptionalStep(6)}
                    >
                      Skip for now
                    </button>
                  </div>
                </Card.Body>
              </>
            )}

            {step === 6 && (
              <>
                <Card.Header>
                  <h1 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--mwm-navy)]">
                    Planning is better with your advisor.
                  </h1>
                  <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
                    Invite them to see your plan and collaborate on strategies. You can always do
                    this later.
                  </p>
                </Card.Header>
                <Card.Body className="space-y-3">
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full"
                    disabled={submitting}
                    onClick={() => handleInviteAdvisor()}
                  >
                    Invite my advisor
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    disabled={submitting}
                    onClick={() => void completeWizard()}
                  >
                    {submitting ? 'Continuing…' : "I'll do this later"}
                  </Button>
                </Card.Body>
              </>
            )}

            {error && <p className="px-6 pb-4 text-sm text-red-600">{error}</p>}

            {step < 6 && (
              <div className="flex items-center justify-between border-t border-[color:var(--mwm-border)] px-6 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() =>
                    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))
                  }
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={submitting || (step === 1 && step1View === 'fork')}
                  onClick={() => {
                    if (step === 1) void saveAsset()
                    else if (step === 2) void saveIncome()
                    else if (step === 3) void saveLiability()
                    else if (step === 4) void saveExpense()
                    else if (step === 5) void saveInsurance()
                  }}
                >
                  {submitting ? 'Saving…' : 'Save & continue'}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <aside className="mt-8 hidden w-full max-w-xs lg:mt-14 lg:block">
          <WizardStepPreviewPanel preview={PREVIEW_BY_STEP[step]} />
        </aside>
      </div>
    </div>
  )
}

function WizardStepPreviewPanel({ preview }: { preview: WizardStepPreview }) {
  return (
    <Card className="border-[color:var(--mwm-gold)] bg-white/80">
      <Card.Body>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mwm-gold)]">
          What you&apos;ll see
        </p>
        <h3 className="mt-3 font-[family-name:var(--font-display)] text-base font-medium text-[color:var(--mwm-navy)]">
          {preview.title}
        </h3>
        <ul className="mt-3 space-y-2">
          {preview.items.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-sm leading-relaxed text-[color:var(--mwm-text-secondary)]"
            >
              <span className="text-[color:var(--mwm-gold)]">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-[color:var(--mwm-border)] pt-4 text-xs leading-relaxed text-[color:var(--mwm-text-muted)]">
          {preview.footer}
        </p>
      </Card.Body>
    </Card>
  )
}

function WizardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={`${formLabelClass} mb-1 block`}>{label}</label>
      {children}
    </div>
  )
}
