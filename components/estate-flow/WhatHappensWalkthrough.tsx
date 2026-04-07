// components/estate-flow/WhatHappensWalkthrough.tsx
// Sprint 60 — "What Happens When I Die?" guided walkthrough
// 5–7 screens generated from estate flow data. Plain English throughout.
// Reachable from dashboard action items and from the EstateTab.

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { EstateFlowGraph } from '@/lib/estate-flow/generateEstateFlow'
import { generateEstateFlow } from '@/lib/estate-flow/generateEstateFlow'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { createClient } from '@/lib/supabase/client'

// ─── Screen definitions ───────────────────────────────────────────────────────

interface Screen {
  id: string
  icon: string
  title: string
  subtitle: string
  content: React.ReactNode
  showIf?: boolean
}

function buildScreens(graph: EstateFlowGraph, person1Name: string): Screen[] {
  const s = graph.summary
  const totalTax = s.estate_tax_federal + s.estate_tax_state
  const assetNodes = graph.nodes.filter(n => n.category === 'asset')
  const trustNodes = graph.nodes.filter(n => n.type === 'trust')
  const beneNodes = graph.nodes.filter(n => n.type === 'beneficiary')

  return [
    // Screen 1: Your assets today
    {
      id: 'assets_today',
      icon: '📊',
      title: 'Your assets today',
      subtitle: "Here's what you own and what it's worth.",
      showIf: true,
      content: (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm leading-relaxed">
            Your total estate — everything you own — is currently estimated at{' '}
            <strong className="text-gray-900">{fmt(s.gross_estate)}</strong>. This includes
            your home, investment accounts, retirement accounts, and any other assets.
          </p>
          {assetNodes.length > 0 && (
            <div className="space-y-2">
              {assetNodes.map(n => (
                <div key={n.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm text-gray-700">{n.label}</span>
                  {n.value > 0 && (
                    <span className="text-sm font-medium text-gray-900">{fmt(n.value)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-3 bg-blue-50 rounded-lg border border-blue-100 mt-2">
            <span className="text-sm font-semibold text-blue-800">Total estate</span>
            <span className="text-sm font-bold text-blue-900">{fmt(s.gross_estate)}</span>
          </div>
        </div>
      ),
    },

    // Screen 2: What passes through your trust
    {
      id: 'trust_transfer',
      icon: '🔒',
      title: s.has_trust
        ? 'What passes through your trust'
        : 'What passes through probate',
      subtitle: s.has_trust
        ? 'Your trust helps your assets bypass the court process.'
        : 'Without a trust, your estate may go through probate.',
      showIf: true,
      content: s.has_trust ? (
        <div className="space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            You have {trustNodes.length === 1 ? 'a trust' : `${trustNodes.length} trusts`} that
            hold{' '}
            <strong className="text-gray-900">{fmt(s.trust_assets_value)}</strong> of your estate.
            Assets held in your trust transfer directly to your heirs — no court process needed.
            This is faster, less expensive, and keeps your estate private.
          </p>
          {trustNodes.map(t => (
            <div key={t.id} className="px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="text-sm font-semibold text-teal-900">{t.label}</div>
              {t.value > 0 && (
                <div className="text-sm text-teal-700 mt-0.5">{fmt(t.value)} in trust</div>
              )}
            </div>
          ))}
          {s.probate_assets_value > 0 && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="text-sm font-semibold text-amber-800">Heads up</div>
              <div className="text-sm text-amber-700 mt-0.5">
                {fmt(s.probate_assets_value)} of your estate is not yet held in your trust
                and may go through probate. Talk to your advisor about retitling these assets.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            Your assets that don't have a named beneficiary — about{' '}
            <strong className="text-gray-900">{fmt(s.probate_assets_value)}</strong> — will go
            through probate when you pass. Probate is a court-supervised process that can take
            months or years and may become public record.
          </p>
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="text-sm font-semibold text-amber-800">Your advisor can help</div>
            <div className="text-sm text-amber-700 mt-0.5">
              A revocable living trust can help most of your estate bypass probate entirely.
              Ask your advisor whether this makes sense for your situation.
            </div>
          </div>
        </div>
      ),
    },

    // Screen 3: What passes outside your trust (direct transfers)
    {
      id: 'direct_transfers',
      icon: '➡️',
      title: 'What transfers directly to your heirs',
      subtitle: 'Some assets skip the trust and probate entirely.',
      showIf: s.direct_transfer_value > 0,
      content: (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm leading-relaxed">
            <strong className="text-gray-900">{fmt(s.direct_transfer_value)}</strong> of your estate
            transfers directly to named beneficiaries through account designations. These assets —
            like retirement accounts and accounts with "payable on death" designations — pass
            automatically, bypassing both your trust and probate.
          </p>
          <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            <strong>Important:</strong> Make sure your beneficiary designations are up to date.
            An outdated designation — like a former spouse — overrides your will.
          </div>
        </div>
      ),
    },

    // Screen 4: Estate tax
    {
      id: 'estate_tax',
      icon: '📋',
      title: 'Your estate tax estimate',
      subtitle: 'What the government may collect before your heirs receive anything.',
      showIf: true,
      content: totalTax > 0 ? (
        <div className="space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            Based on your current estate size, your estimated estate tax is{' '}
            <strong className="text-gray-900">{fmt(totalTax)}</strong>. This is paid from your
            estate before your heirs receive anything.
          </p>
          <div className="space-y-2">
            {s.estate_tax_federal > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-100">
                <span className="text-sm text-amber-800">Federal estate tax</span>
                <span className="text-sm font-medium text-amber-900">{fmt(s.estate_tax_federal)}</span>
              </div>
            )}
            {s.estate_tax_state > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-100">
                <span className="text-sm text-amber-800">State estate tax</span>
                <span className="text-sm font-medium text-amber-900">{fmt(s.estate_tax_state)}</span>
              </div>
            )}
          </div>
          <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            Your advisor can show you strategies — such as gifting, trusts, and life insurance —
            that can significantly reduce this number.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm leading-relaxed">
            Based on your current estate size, your estate falls below the federal estate tax
            threshold. You currently have <strong className="text-gray-900">no federal estate tax</strong>.
          </p>
          <div className="px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800">
            <strong>Good news.</strong> Your advisor can show you strategies to protect this
            position even if your estate grows or the law changes.
          </div>
        </div>
      ),
    },

    // Screen 5: What your heirs receive
    {
      id: 'heirs_receive',
      icon: '💚',
      title: 'What your heirs receive',
      subtitle: 'The bottom line for the people you care about most.',
      showIf: true,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            After all taxes and expenses, your heirs are estimated to receive{' '}
            <strong className="text-gray-900">{fmt(s.net_to_heirs)}</strong> from your estate.
          </p>
          {beneNodes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Your heirs</div>
              {beneNodes.map(b => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 bg-green-50 rounded-lg border border-green-100">
                  <div className="w-7 h-7 rounded-full bg-green-200 flex items-center justify-center text-green-800 text-xs font-medium">
                    {b.label[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-green-800">{b.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { label: 'Total estate', value: s.gross_estate, color: 'text-gray-800' },
              { label: 'Estate taxes', value: totalTax, color: 'text-amber-700' },
              { label: 'Heirs receive', value: s.net_to_heirs, color: 'text-green-700' },
            ].map(item => (
              <div key={item.label} className="text-center px-2 py-3 bg-gray-50 rounded-lg">
                <div className={`text-sm font-bold ${item.color}`}>{fmt(item.value)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // Screen 6: Business succession (conditional)
    {
      id: 'business_succession',
      icon: '🏢',
      title: 'What happens to your business',
      subtitle: 'Business interests need special planning.',
      showIf: s.has_business,
      content: (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm leading-relaxed">
            You have a business interest in your estate. Business succession planning is one of
            the most complex parts of estate planning — your advisor can help you structure this
            correctly.
          </p>
          <div className="space-y-2">
            <div className="px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
              <strong>Questions to discuss with your advisor:</strong>
              <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
                <li>Who will own or operate the business after you pass?</li>
                <li>Is there a buy-sell agreement in place?</li>
                <li>How is the business valued for estate tax purposes?</li>
                <li>Could a family limited partnership reduce your estate tax exposure?</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },

    // Screen 7: Digital assets (conditional)
    {
      id: 'digital_assets',
      icon: '💻',
      title: 'Your digital assets',
      subtitle: 'Online accounts and digital property need a plan too.',
      showIf: s.has_digital_assets,
      content: (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm leading-relaxed">
            You have digital assets — such as cryptocurrency, online financial accounts, or other
            digital property — in your estate. Without clear instructions, your heirs may not be
            able to access these accounts.
          </p>
          <div className="px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-800">
            <strong>Digital executor.</strong> Consider designating a trusted person as your
            digital executor — someone who knows how to access and manage your digital accounts.
            Your advisor can help you document this as part of your estate plan.
          </div>
        </div>
      ),
    },
  ].filter(screen => screen.showIf !== false)
}

// ─── Main walkthrough component ───────────────────────────────────────────────

interface Props {
  householdId: string
  scenarioId: string | null
  onComplete?: () => void
}

export default function WhatHappensWalkthrough({ householdId, scenarioId, onComplete }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [graph, setGraph] = useState<EstateFlowGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    generateEstateFlow(householdId, scenarioId, 'first_death', supabase)
      .then(setGraph)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [householdId, scenarioId, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p>Loading your estate plan…</p>
        </div>
      </div>
    )
  }

  if (!graph) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Add assets to see your estate walkthrough.
      </div>
    )
  }

  const screens = buildScreens(graph, 'you')
  const screen = screens[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === screens.length - 1

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex gap-1.5 mb-6">
        {screens.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Screen */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="text-3xl mb-3">{screen.icon}</div>
          <h2 className="text-lg font-semibold text-gray-900">{screen.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{screen.subtitle}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">{screen.content}</div>

        {/* Navigation */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={isFirst}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          <span className="text-xs text-gray-400">
            {currentStep + 1} of {screens.length}
          </span>

          {isLast ? (
            <button
              onClick={onComplete}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Done ✓
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <DisclaimerBanner />
      </div>
    </div>
  )
}

function fmt(n: number): string {
  if (!n || n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}
