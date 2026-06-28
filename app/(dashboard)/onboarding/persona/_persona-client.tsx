'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { captureFunnelEvent } from '@/lib/analytics/useFunnelEvent'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  type OnboardingPersona,
} from '@/lib/onboarding/personaConfig'
import { cn } from '@/lib/utils'

type PersonaCardDef = {
  key: OnboardingPersona
  headline: string
  body: string
  Icon: () => React.JSX.Element
}

function BriefcaseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 9h2M8 13h2M14 9h2M14 13h2M8 17h8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function TrendingUpIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 17l6-6 4 4 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 7h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PiggyBankIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="13" rx="8" ry="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="11" r="1" fill="currentColor" />
      <path d="M6 13H4M20 13h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 7V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const PERSONA_CARDS: PersonaCardDef[] = [
  {
    key: 'business_owner',
    headline: 'I own a business',
    body: 'See your succession exposure, entity structure gaps, and what happens to your business interest in your estate.',
    Icon: BriefcaseIcon,
  },
  {
    key: 'real_estate',
    headline: 'I own real estate',
    body: 'Map your properties by situs state, surface beneficiary gaps, and see your real estate\'s place in your estate plan.',
    Icon: BuildingIcon,
  },
  {
    key: 'executive',
    headline: 'I have executive compensation',
    body: 'Track RSUs, stock options, and deferred comp alongside your broader estate — and see your estate tax exposure.',
    Icon: TrendingUpIcon,
  },
  {
    key: 'accumulator',
    headline: 'I\'m building toward retirement',
    body: 'Project your retirement timeline, savings rate, and estate position as you grow your net worth.',
    Icon: PiggyBankIcon,
  },
]

export function PersonaOnboardingClient() {
  const router = useRouter()
  const [selected, setSelected] = useState<OnboardingPersona | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedRef = useRef(false)
  const selectedRef = useRef<OnboardingPersona | null>(null)
  selectedRef.current = selected

  useEffect(() => {
    captureFunnelEvent({ event_name: 'persona_screen_shown', properties: {} })
  }, [])

  useEffect(() => {
    return () => {
      if (savedRef.current || selectedRef.current) return
      captureFunnelEvent({
        event_name: 'persona_skipped',
        properties: { via: 'sidebar' },
      })
      void fetch('/api/consumer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_persona: 'accumulator' }),
      }).catch(() => {})
    }
  }, [])

  async function handleContinue() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_persona: selected }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save selection')
      }
      savedRef.current = true
      captureFunnelEvent({
        event_name: 'persona_selected',
        properties: { persona: selected },
      })
      router.push('/onboarding/wizard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-gold)]"
        >
          ← Back to getting started
        </Link>
      </p>
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--mwm-gold)]">
          Guided setup
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[color:var(--mwm-navy)]">
          What describes you?
        </h1>
        <p className="mt-2 text-sm text-[color:var(--mwm-text-secondary)]">
          Pick the path that fits best — we&apos;ll tailor the walkthrough to your situation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PERSONA_CARDS.map(({ key, headline, body, Icon }) => {
          const isSelected = selected === key
          return (
            <Card
              key={key}
              hoverable
              onClick={() => setSelected(key)}
              className={cn(
                'cursor-pointer transition-all',
                isSelected &&
                  'border-[var(--mwm-gold)] ring-2 ring-[var(--mwm-gold)] ring-offset-2',
              )}
              aria-pressed={isSelected}
            >
              <Card.Body className="p-5">
                <div className="mb-3 text-[color:var(--mwm-navy)]">
                  <Icon />
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-[color:var(--mwm-navy)]">
                  {headline}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--mwm-text-secondary)]">
                  {body}
                </p>
              </Card.Body>
            </Card>
          )
        })}
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 flex justify-center">
        <Button
          variant="primary"
          disabled={!selected || submitting}
          onClick={() => void handleContinue()}
          className="min-w-[200px]"
        >
          {submitting ? 'Saving…' : 'Continue →'}
        </Button>
      </div>
    </div>
  )
}
