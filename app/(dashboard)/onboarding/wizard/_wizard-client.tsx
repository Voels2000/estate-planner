'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass, formLabelClass } from '@/components/ui/form'
import type { SetupProgressCounts } from '@/lib/consumer/setupProgressCounts'
import { cn } from '@/lib/utils'

type RefOption = { value: string; label: string }

type Props = {
  person1Label: string
  person2Label: string
  hasSpouse: boolean
  assetTypes: RefOption[]
  incomeTypes: RefOption[]
  inviteMailto: string
}

type WizardStepPreview = {
  title: string
  items: string[]
  footer: string
}

const PREVIEW_BY_STEP: Record<1 | 2 | 3, WizardStepPreview> = {
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
    title: 'Why connecting your advisor matters',
    items: [
      'Live plan access — your advisor sees your current estate health score',
      'Strategy recommendations — they can propose actions you accept or reject',
      'Better conversations — arrive at every meeting with your data organized',
    ],
    footer:
      'At the $2M–$30M level, a coordinated advisor relationship is one of the highest-value planning decisions you can make.',
  },
}

function firstIncompleteStep(progress: SetupProgressCounts): 1 | 2 | 3 {
  if (progress.assets <= 0) return 1
  if (progress.income <= 0) return 2
  return 3
}

export function OnboardingWizardClient({
  person1Label,
  person2Label,
  hasSpouse,
  assetTypes,
  incomeTypes,
  inviteMailto,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
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

  const sortedAssetTypes = [...assetTypes].sort((a, b) => a.label.localeCompare(b.label))
  const sortedIncomeTypes = [...incomeTypes].sort((a, b) => a.label.localeCompare(b.label))
  const defaultIncomeType =
    sortedIncomeTypes.find((t) => t.value === 'salary')?.value ??
    sortedIncomeTypes[0]?.value ??
    'salary'

  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState(sortedAssetTypes[0]?.value ?? '')
  const [assetValue, setAssetValue] = useState('')
  const [assetOwner, setAssetOwner] = useState('person1')

  const [incomeName, setIncomeName] = useState('')
  const [incomeSource, setIncomeSource] = useState(defaultIncomeType)
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeOwner, setIncomeOwner] = useState('person1')

  const currentYear = new Date().getFullYear()

  const stepComplete = (n: 1 | 2 | 3) => {
    if (!progress) return false
    if (n === 1) return progress.assets > 0
    if (n === 2) return progress.income > 0
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

  function handleInviteAdvisor() {
    window.location.href = inviteMailto
    void completeWizard()
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
              onClick={() => router.push('/dashboard')}
              className="text-xs text-[color:var(--mwm-text-muted)] underline-offset-2 hover:text-[color:var(--mwm-navy)] hover:underline"
            >
              ← Back to dashboard
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((n) => (
              <div key={n} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(n)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors',
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
                {n < 3 && (
                  <div
                    className={cn(
                      'h-px w-8',
                      stepComplete(n) ? 'bg-[var(--mwm-sage)]' : 'bg-[var(--mwm-border)]',
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          <Card className="mt-6 shadow-[var(--mwm-shadow)]">
            {step === 1 && (
              <>
                <Card.Header>
                  <h1 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--mwm-navy)]">
                    What&apos;s your most significant asset?
                  </h1>
                  <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
                    This gives us your starting net worth and flags any titling gaps.
                  </p>
                </Card.Header>
                <Card.Body className="space-y-4">
                  <WizardField label="Asset name">
                    <input
                      type="text"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      className={formControlClass}
                      placeholder="Primary home, 401(k)"
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
                  <button
                    type="button"
                    className="text-sm text-[color:var(--mwm-text-secondary)] underline-offset-2 hover:underline"
                    onClick={() => setStep(2)}
                  >
                    Skip this step →
                  </button>
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
                  <button
                    type="button"
                    className="text-sm text-[color:var(--mwm-text-secondary)] underline-offset-2 hover:underline"
                    onClick={() => setStep(3)}
                  >
                    Skip this step →
                  </button>
                </Card.Body>
              </>
            )}

            {step === 3 && (
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

            {step < 3 && (
              <div className="flex items-center justify-between border-t border-[color:var(--mwm-border)] px-6 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={submitting}
                  onClick={() => {
                    if (step === 1) void saveAsset()
                    else if (step === 2) void saveIncome()
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
