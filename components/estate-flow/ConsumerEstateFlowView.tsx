// components/estate-flow/ConsumerEstateFlowView.tsx
// Sprint 60 — Consumer-facing plain-English estate flow diagram
// Shown in the consumer EstateTab. First-death view by default.
// No toggle controls, no tax jargon — answers "What happens when I die?"

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { EstateFlowGraph, FlowNode, DeathView, EstateHorizon } from '@/lib/estate-flow/generateEstateFlow'
import { generateEstateFlow } from '@/lib/estate-flow/generateEstateFlow'
import { createClient } from '@/lib/supabase/client'

// ─── Plain-English flow card ──────────────────────────────────────────────────

interface FlowStep {
  icon: string
  title: string
  body: string
  value?: string
  highlight?: boolean
}

function fmtHeirsCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function buildFlowSteps(
  graph: EstateFlowGraph,
  heirsToday: { gross: number; totalTax: number; asOfLabel: string } | null,
  horizonLabel: string,
): FlowStep[] {
  const steps: FlowStep[] = []
  const s = graph.summary

  // Step 1: your estate
  steps.push({
    icon: '🏠',
    title: 'Your estate',
    body: `Your total estate — including your home, investments, and other assets — is estimated at ${fmt(s.gross_estate)}.`,
    value: fmt(s.gross_estate),
  })

  // Step 2: trust (if any)
  if (s.has_trust && s.trust_assets_value > 0) {
    steps.push({
      icon: '🔒',
      title: 'What passes through your trust',
      body: `${fmt(s.trust_assets_value)} of your estate is held in a trust. These assets transfer directly to your beneficiaries — no court process required.`,
      value: fmt(s.trust_assets_value),
    })
  }

  // Step 3: direct transfers (beneficiary designations)
  if (s.direct_transfer_value > 0) {
    steps.push({
      icon: '➡️',
      title: 'What transfers directly to your heirs',
      body: `${fmt(s.direct_transfer_value)} passes directly to named beneficiaries through account designations (such as POD or TOD accounts, or retirement accounts with a named beneficiary). These bypass probate.\n\nEstimate shown for ${horizonLabel}.`,
      value: fmt(s.direct_transfer_value),
    })
  }

  // Step 4: probate (if any)
  if (s.probate_assets_value > 0) {
    steps.push({
      icon: '⚖️',
      title: 'What passes through your estate',
      body: `${fmt(s.probate_assets_value)} of your estate has no trust or beneficiary designation and would go through the court process (probate) before reaching your heirs. Your will directs how these assets are distributed.\n\nEstimate shown for ${horizonLabel}.`,
      value: fmt(s.probate_assets_value),
      highlight: s.probate_assets_value > 100_000,
    })
  }

  // Step 5: estate taxes
  const totalTax = s.estate_tax_federal + s.estate_tax_state
  if (totalTax > 0) {
    steps.push({
      icon: '📋',
      title: 'Your estate tax estimate',
      body: `Based on your current estate size, your estimated estate tax is ${fmt(totalTax)} (${fmt(s.estate_tax_federal)} federal${s.estate_tax_state > 0 ? ` + ${fmt(s.estate_tax_state)} state` : ''}). Your advisor can show you strategies to reduce this amount.`,
      value: fmt(totalTax),
      highlight: true,
    })
  } else {
    steps.push({
      icon: '✅',
      title: 'Your estate tax estimate',
      body: 'Based on your current estate size, your estate currently falls below the federal estate tax threshold. Your advisor can show you how to protect this position.',
    })
  }

  // Step 6: what heirs receive (today's estate minus today's tax — not projection net_to_heirs)
  const heirsReceive =
    heirsToday != null
      ? Math.max(0, heirsToday.gross - heirsToday.totalTax)
      : s.net_to_heirs
  if (heirsReceive > 0) {
    const valueStr = fmtHeirsCurrency(heirsReceive)
    steps.push({
      icon: '💚',
      title: 'What your heirs receive (estimated)',
      body:
        heirsToday != null
          ? `What your heirs receive (estimated): ${valueStr}\n\nBased on your estate as of ${heirsToday.asOfLabel}.\n\nYour advisor can show you planning strategies to increase this amount.`
          : `After all taxes, your heirs are estimated to receive ${fmt(heirsReceive)}. Your advisor can show you planning strategies to increase this amount.`,
      value: heirsToday != null ? valueStr : fmt(heirsReceive),
    })
  }

  // Step 7: digital assets (if any)
  if (s.has_digital_assets) {
    steps.push({
      icon: '💻',
      title: 'Your digital assets',
      body: 'You have digital assets on file. Make sure your digital executor knows how to access and manage these accounts. Talk to your advisor about including digital asset instructions in your estate plan.',
    })
  }

  return steps
}

// ─── Node type icons for consumer visual flow ─────────────────────────────────

const CONSUMER_NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  person:        { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800' },
  asset:         { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
  real_estate:   { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  digital_asset: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800' },
  business:      { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
  insurance:     { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-800' },
  trust:         { bg: 'bg-teal-50',   border: 'border-teal-300',   text: 'text-teal-900' },
  probate:       { bg: 'bg-gray-50',   border: 'border-gray-300',   text: 'text-gray-700' },
  beneficiary:   { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800' },
  tax_deduction: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800' },
}

function ConsumerNodePill({ node }: { node: FlowNode }) {
  const c = CONSUMER_NODE_COLORS[node.type] ?? CONSUMER_NODE_COLORS.asset
  return (
    <div className={`inline-flex flex-col items-center px-4 py-3 rounded-xl border ${c.bg} ${c.border} shadow-sm min-w-[120px]`}>
      <span className={`text-sm font-medium ${c.text} text-center leading-tight`}>
        {node.label}
      </span>
      {node.value > 0 && (
        <span className={`text-xs ${c.text} opacity-70 mt-0.5`}>
          {node.type === 'business' ? fmtHeirsCurrency(node.value) : fmt(node.value)}
        </span>
      )}
    </div>
  )
}

// ─── Main consumer component ──────────────────────────────────────────────────

interface Props {
  householdId: string
  scenarioId: string | null
  /** e.g. "April 2026" — shown with heirs receive */
  estateAsOfLabel: string
  /** Live net worth from the dashboard — passed so "Today" horizon matches dashboard figures. */
  liveNetWorth: number
  /** Whether the household has a spouse (enables death-view picker). */
  hasSpouse: boolean
  /** When true, the page title block is omitted (e.g. when wrapped in CollapsibleSection). */
  hidePageHeader?: boolean
}

export default function ConsumerEstateFlowView({
  householdId,
  scenarioId,
  estateAsOfLabel,
  liveNetWorth,
  hasSpouse,
  hidePageHeader = false,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [horizon, setHorizon] = useState<EstateHorizon>('today')
  const [deathView, setDeathView] = useState<DeathView>('first_death')
  const [graph, setGraph] = useState<EstateFlowGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<number | null>(null)

  useEffect(() => {
    const startTimeoutId = window.setTimeout(() => setLoading(true), 0)
    generateEstateFlow(householdId, scenarioId, deathView, supabase, false, horizon, liveNetWorth)
      .then(setGraph)
      .catch(console.error)
      .finally(() => setLoading(false))
    return () => window.clearTimeout(startTimeoutId)
  }, [householdId, scenarioId, supabase, horizon, deathView, liveNetWorth])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading your estate overview…
      </div>
    )
  }

  if (!graph) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Add assets and documents to see your estate flow.
      </div>
    )
  }

  const heirsTodayContext =
    horizon === 'today'
      ? {
          gross: graph.summary.gross_estate,
          totalTax: graph.summary.estate_tax_federal + graph.summary.estate_tax_state,
          asOfLabel: estateAsOfLabel,
        }
      : null

  const horizonLabel =
    horizon === 'today'
      ? estateAsOfLabel
      : horizon === 'ten_year'
        ? 'In 10 Years'
        : horizon === 'twenty_year'
          ? 'In 20 Years'
          : 'At Longevity'

  const steps = buildFlowSteps(graph, heirsTodayContext, horizonLabel)

  // Simplified visual: show owner → assets → vehicles → recipients in rows
  const ownerNodes = graph.nodes.filter(n => n.category === 'owner')
  const assetNodes = graph.nodes.filter(n => n.category === 'asset')
  const vehicleNodes = graph.nodes.filter(n => n.category === 'vehicle')
  const recipientNodes = graph.nodes.filter(n => n.category === 'recipient')

  return (
    <div className="space-y-6">
      {!hidePageHeader && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900">What happens when I die?</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s how your estate transfers to your heirs — in plain English.
          </p>
        </div>
      )}

      {/* Scenario pickers — plain-English labels for consumer */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden text-xs" role="group" aria-label="When">
          {([
            { value: 'today',        label: 'Today' },
            { value: 'ten_year',     label: 'In 10 Years' },
            { value: 'twenty_year',  label: 'In 20 Years' },
            { value: 'at_longevity', label: 'At Longevity' },
          ] as const).map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => setHorizon(opt.value)}
              className={`px-3 py-1.5 transition-colors ${
                horizon === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              } ${i > 0 ? 'border-l border-gray-200' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {hasSpouse && (
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden text-xs" role="group" aria-label="Who dies first">
            {([
              { value: 'first_death',  label: 'If I die first' },
              { value: 'second_death', label: 'If my spouse dies first' },
            ] as const).map((opt, i) => (
              <button
                key={opt.value}
                onClick={() => setDeathView(opt.value)}
                className={`px-3 py-1.5 transition-colors ${
                  deathView === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                } ${i > 0 ? 'border-l border-gray-200' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Visual flow */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
        {/* Layer 1: Owners */}
        <FlowLayer label="Your estate" nodes={ownerNodes} />

        {/* Arrow */}
        <FlowArrow label="passes to" />

        {/* Layer 2: Assets */}
        {assetNodes.length > 0 && (
          <>
            <FlowLayer label="Your assets" nodes={assetNodes} />
            <FlowArrow label="transfer through" />
          </>
        )}

        {/* Layer 3: Vehicles (trusts, probate) */}
        {vehicleNodes.length > 0 && (
          <>
            <FlowLayer label="How they transfer" nodes={vehicleNodes} />
            <FlowArrow label="then to" />
          </>
        )}

        {/* Layer 4: Recipients */}
        {recipientNodes.length > 0 && (
          <FlowLayer label="Your heirs" nodes={recipientNodes} />
        )}
      </div>

      {/* Step-by-step explanation */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3">Step by step</h3>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(activeStep === i ? null : i)}
              className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${
                step.highlight
                  ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">{step.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800">{step.title}</span>
                    {step.value && (
                      <span className="text-sm font-medium text-gray-600 shrink-0">
                        {step.value}
                      </span>
                    )}
                  </div>
                  {activeStep === i && (
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-line">
                      {step.body}
                    </p>
                  )}
                </div>
                <span className="text-gray-400 text-sm">{activeStep === i ? '▲' : '▼'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="text-xs text-gray-500 mb-0.5">Through your trust</div>
          <div className="text-base font-semibold text-gray-800">{fmt(graph.summary.trust_assets_value)}</div>
        </div>
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="text-xs text-gray-500 mb-0.5">Through probate</div>
          <div className="text-base font-semibold text-amber-800">{fmt(graph.summary.probate_assets_value)}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlowLayer({ label, nodes }: { label: string; nodes: FlowNode[] }) {
  if (nodes.length === 0) return null
  return (
    <div>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {nodes.map(n => (
          <ConsumerNodePill key={n.id} node={n} />
        ))}
      </div>
    </div>
  )
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-400 text-xs pl-2">
      <div className="w-px h-6 bg-gray-200" />
      <span>{label}</span>
    </div>
  )
}

function fmt(n: number): string {
  if (!n || n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}
