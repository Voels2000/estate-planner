'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { captureFunnelEvent } from '@/lib/analytics/useFunnelEvent'
import type { OnboardingPersona } from '@/lib/onboarding/personaConfig'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'persona_insight_dismissed'

interface PersonaInsightCardProps {
  persona: OnboardingPersona
  totalAssets: number
  hasBusinessAsset: boolean
  hasRealEstateAsset: boolean
  distinctPropertyStates: number
  estateTaxEstimate: number | null
  retirementAge: number | null
  currentAge: number | null
  yearsToRetirement: number | null
  showCard: boolean
}

type InsightContent = {
  headline: string
  body: string
  ctaHref: string
  ctaLabel: string
  icon: 'briefcase' | 'building' | 'trending' | 'piggy'
}

function buildInsightContent(props: PersonaInsightCardProps): InsightContent {
  const {
    persona,
    hasBusinessAsset,
    hasRealEstateAsset,
    distinctPropertyStates,
    estateTaxEstimate,
    retirementAge,
    currentAge,
    yearsToRetirement,
  } = props

  switch (persona) {
    case 'business_owner':
      if (hasBusinessAsset) {
        return {
          icon: 'briefcase',
          headline: 'Your business interest needs a succession plan',
          body: 'Business assets without a buy-sell agreement or succession plan can create significant estate complications. Review your options →',
          ctaHref: '/business-succession',
          ctaLabel: 'Review succession exposure',
        }
      }
      return {
        icon: 'briefcase',
        headline: 'Add your business to see succession exposure',
        body: 'Business interests are often the hardest estate assets to plan around. Add yours to surface gaps.',
        ctaHref: '/businesses',
        ctaLabel: 'Add business interest',
      }

    case 'real_estate':
      if (hasRealEstateAsset) {
        const stateCount = Math.max(distinctPropertyStates, 1)
        const stateLabel = stateCount === 1 ? '1 state' : `${stateCount} states`
        return {
          icon: 'building',
          headline: `You have real estate in ${stateLabel}`,
          body: 'Properties held in multiple states create probate exposure in each state. Review your titling and beneficiary designations.',
          ctaHref: '/real-estate',
          ctaLabel: 'Review property exposure',
        }
      }
      return {
        icon: 'building',
        headline: 'Add your properties to map situs exposure',
        body: 'Real estate held in multiple states requires probate in each. Add your properties to see your exposure.',
        ctaHref: '/real-estate',
        ctaLabel: 'Add property',
      }

    case 'executive':
      if (estateTaxEstimate != null && estateTaxEstimate > 0) {
        return {
          icon: 'trending',
          headline: 'Your estimated estate may have federal tax exposure',
          body: 'Based on the assets you\'ve entered, your estate may be above the federal exemption threshold. Review your estate tax position.',
          ctaHref: '/estate-tax',
          ctaLabel: 'Review estate tax estimate',
        }
      }
      return {
        icon: 'trending',
        headline: 'Add your full investment picture to see estate tax exposure',
        body: 'RSUs, brokerage accounts, and deferred comp all count toward your taxable estate. Add them to see your position.',
        ctaHref: '/assets',
        ctaLabel: 'Add investment accounts',
      }

    case 'accumulator':
    default:
      if (retirementAge && currentAge != null && yearsToRetirement != null) {
        return {
          icon: 'piggy',
          headline: `You're ${yearsToRetirement} years from your target retirement age`,
          body: 'Based on your current assets and income, here\'s where your retirement projection stands.',
          ctaHref: '/projections',
          ctaLabel: 'See retirement projection',
        }
      }
      return {
        icon: 'piggy',
        headline: 'Set your retirement age to see your timeline',
        body: 'Your retirement projection is ready — we just need your target retirement age.',
        ctaHref: '/profile',
        ctaLabel: 'Add retirement age',
      }
  }
}

function InsightIcon({ kind }: { kind: InsightContent['icon'] }) {
  const className = 'text-[var(--mwm-gold)]'
  switch (kind) {
    case 'briefcase':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 'building':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 9h2M8 13h2M14 9h2M14 13h2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 'trending':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 17l6-6 4 4 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'piggy':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <ellipse cx="12" cy="13" rx="8" ry="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16" cy="11" r="1" fill="currentColor" />
        </svg>
      )
  }
}

export function PersonaInsightCard(props: PersonaInsightCardProps) {
  const { persona, totalAssets, showCard } = props
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === 'true')
  }, [])

  useEffect(() => {
    if (!showCard || dismissed || totalAssets <= 0) return
    captureFunnelEvent({
      event_name: 'persona_insight_shown',
      properties: { persona },
    })
  }, [showCard, dismissed, totalAssets, persona])

  if (!showCard || dismissed || totalAssets <= 0) return null

  const content = buildInsightContent(props)

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
    captureFunnelEvent({
      event_name: 'persona_insight_dismissed',
      properties: { persona },
    })
  }

  function handleCtaClick() {
    captureFunnelEvent({
      event_name: 'persona_insight_clicked',
      properties: { persona, cta_href: content.ctaHref },
    })
  }

  return (
    <div
      className={cn(
        'relative mt-4 rounded-xl border border-[var(--mwm-border)] bg-white p-5 shadow-sm',
        'border-l-4 border-l-[var(--mwm-navy)]',
      )}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600"
        aria-label="Dismiss"
      >
        ✕
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 shrink-0">
          <InsightIcon kind={content.icon} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--mwm-navy)]">{content.headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--mwm-text-secondary)]">
            {content.body}
          </p>
          <Link
            href={content.ctaHref}
            onClick={handleCtaClick}
            className="mt-2 inline-block text-xs font-medium text-[color:var(--mwm-navy)] underline-offset-2 hover:underline"
          >
            {content.ctaLabel} →
          </Link>
          <p className="mt-3 text-[10px] leading-relaxed text-[color:var(--mwm-text-muted)]">
            This is for planning preparation only — not financial or legal advice.
          </p>
        </div>
      </div>
    </div>
  )
}
