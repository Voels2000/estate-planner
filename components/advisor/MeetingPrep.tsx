// Sprint 62 — Meeting Preparation Mode
// Session 33: Estate Snapshot now shows current estate via /api/estate-composition.
// Falls back to projection at-death row if composition fetch is unavailable.

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { HealthScoreBadge } from '@/components/shared/HealthScoreBadge'
import { scoreContextSentenceForAdvisor } from '@/lib/estate-health-score'
import {
  meetingPrepBriefFromHorizons,
  type MeetingPrepHorizonColumn,
} from '@/lib/advisor/meetingPrepHorizons'
import type { EstateComposition } from '@/lib/estate/types'
import type { MyEstateStrategyHorizonsResult } from '@/lib/my-estate-strategy/horizonSnapshots'

const STRATEGY_LABELS: Record<string, string> = {
  gifting: 'Annual Gifting Program',
  revocable_trust: 'Revocable Living Trust',
  credit_shelter_trust: 'Credit Shelter Trust (CST)',
  grat: 'Grantor Retained Annuity Trust (GRAT)',
  crt: 'Charitable Remainder Trust (CRT)',
  clat: 'Charitable Lead Annuity Trust (CLAT)',
  daf: 'Donor Advised Fund (DAF)',
  roth: 'Roth Conversion',
  liquidity: 'Estate Liquidity Planning',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingBrief {
  client_name: string
  health_score_today: number | null
  health_score_last_meeting: number | null
  health_score_delta: number | null
  top_alerts: Array<{ title: string; severity: string; description: string }>
  // Current estate (from estate composition API)
  current_gross_estate: number | null
  current_taxable_estate: number | null
  current_estimated_tax: number | null
  estimated_tax_state: number | null
  estimated_tax_state_with_cst: number | null
  cst_benefit: number | null
  cst_benefit_at_death: number | null
  has_portability_gap: boolean | null
  // At-death projection (from projection_scenarios)
  gross_estate: number | null
  estate_tax: number | null
  net_to_heirs: number | null
  cost_of_inaction: number | null
  recommended_strategies: string[]
  last_note: string | null
  last_note_date: string | null
  has_projection: boolean
  horizon_columns: MeetingPrepHorizonColumn[]
  at_death_label: string | null
  generated_at: string
}

interface MeetingBriefSeed {
  health_score_today?: number | null
  top_alerts?: Array<{ title: string; severity: string; description: string }>
  current_gross_estate?: number | null
  current_taxable_estate?: number | null
  current_estimated_tax?: number | null
  estimated_tax_state?: number | null
  estimated_tax_state_with_cst?: number | null
  cst_benefit?: number | null
  cst_benefit_at_death?: number | null
  has_portability_gap?: boolean | null
  gross_estate?: number | null
  estate_tax?: number | null
  net_to_heirs?: number | null
  cost_of_inaction?: number | null
  recommended_strategies?: string[]
  last_note?: string | null
  last_note_date?: string | null
  has_projection?: boolean
  horizon_columns?: MeetingPrepHorizonColumn[]
  at_death_label?: string | null
}

interface Props {
  clientId: string
  householdId: string
  clientName: string
  advisorHorizons?: MyEstateStrategyHorizonsResult
  initialHealthScore?: number | null
  initialBriefSeed?: MeetingBriefSeed | null
  estateComposition?: EstateComposition | null
  /** When true, opening the brief uses server seed only (no client refetch) */
  briefHydratedFromServer?: boolean
  /** Full narrative estate report — opens via API when present */
  estateReportPdfUrl?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildBriefFromSeed(clientName: string, seed: MeetingBriefSeed): MeetingBrief {
  return {
    client_name: clientName,
    health_score_today: seed.health_score_today ?? null,
    health_score_last_meeting: null,
    health_score_delta: null,
    top_alerts: seed.top_alerts ?? [],
    current_gross_estate: seed.current_gross_estate ?? null,
    current_taxable_estate: seed.current_taxable_estate ?? null,
    current_estimated_tax: seed.current_estimated_tax ?? null,
    estimated_tax_state: seed.estimated_tax_state ?? null,
    estimated_tax_state_with_cst: seed.estimated_tax_state_with_cst ?? null,
    cst_benefit: seed.cst_benefit ?? null,
    cst_benefit_at_death: seed.cst_benefit_at_death ?? null,
    has_portability_gap: seed.has_portability_gap ?? null,
    gross_estate: seed.gross_estate ?? null,
    estate_tax: seed.estate_tax ?? null,
    net_to_heirs: seed.net_to_heirs ?? null,
    cost_of_inaction: seed.cost_of_inaction ?? null,
    recommended_strategies: seed.recommended_strategies ?? [],
    last_note: seed.last_note ?? null,
    last_note_date: seed.last_note_date ?? null,
    has_projection: seed.has_projection ?? false,
    horizon_columns: seed.horizon_columns ?? [],
    at_death_label: seed.at_death_label ?? null,
    generated_at: new Date().toISOString(),
  }
}

function mergeHorizonBrief(
  brief: MeetingBrief,
  horizons: MyEstateStrategyHorizonsResult | undefined,
): MeetingBrief {
  const fromHorizons = meetingPrepBriefFromHorizons(horizons)
  if (!fromHorizons) return brief
  return {
    ...brief,
    current_gross_estate: fromHorizons.current_gross_estate ?? brief.current_gross_estate,
    current_estimated_tax: fromHorizons.current_estimated_tax ?? brief.current_estimated_tax,
    estimated_tax_state: fromHorizons.estimated_tax_state ?? brief.estimated_tax_state,
    estimated_tax_state_with_cst:
      fromHorizons.estimated_tax_state_with_cst ?? brief.estimated_tax_state_with_cst,
    cst_benefit: fromHorizons.cst_benefit ?? brief.cst_benefit,
    has_portability_gap: fromHorizons.has_portability_gap ?? brief.has_portability_gap,
    cst_benefit_at_death: fromHorizons.cst_benefit_at_death ?? brief.cst_benefit_at_death,
    gross_estate: fromHorizons.gross_estate ?? brief.gross_estate,
    estate_tax: fromHorizons.estate_tax ?? brief.estate_tax,
    net_to_heirs: fromHorizons.net_to_heirs ?? brief.net_to_heirs,
    cost_of_inaction: fromHorizons.cost_of_inaction ?? brief.cost_of_inaction,
    has_projection: fromHorizons.has_projection || brief.has_projection,
    horizon_columns: fromHorizons.horizon_columns,
    at_death_label: fromHorizons.at_death_label,
  }
}

// ─── Meeting brief generator ──────────────────────────────────────────────────

async function generateMeetingBrief(
  clientId: string,
  householdId: string,
  clientName: string,
  initialHealthScore?: number | null,
  advisorHorizons?: MyEstateStrategyHorizonsResult,
  preloadedComposition?: EstateComposition | null,
): Promise<MeetingBrief> {
  const supabase = createClient()

  const compositionPromise = preloadedComposition
    ? Promise.resolve(preloadedComposition)
    : fetch('/api/estate-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          sourceRole: 'consumer',
        }),
      })
        .then(async (res) => (res.ok ? await res.json() : null))
        .catch(() => null)

  const [
    alertsRes,
    projectionRes,
    notesRes,
    strategyConfigsRes,
    advisorLineItemsRes,
    compositionData,
  ] = await Promise.all([
    supabase
      .from('household_alerts')
      .select('title, severity, description')
      .eq('household_id', householdId)
      .is('resolved_at', null)
      .is('dismissed_at', null)
      .order('severity', { ascending: false })
      .limit(3),
    supabase
      .from('projection_scenarios')
      .select('outputs_s1_first, status')
      .eq('household_id', householdId)
      .eq('status', 'saved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('advisor_notes')
      .select('content, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('strategy_configs')
      .select('strategy_type, label')
      .eq('household_id', householdId)
      .eq('is_active', true),
    supabase
      .from('strategy_line_items')
      .select('strategy_source, amount, confidence_level, source_role')
      .eq('household_id', householdId)
      .eq('source_role', 'advisor')
      .eq('is_active', true),
    compositionPromise,
  ])

  const alerts = alertsRes.data ?? []
  const projection = projectionRes.data
  const lastNote = notesRes.data
  const strategyConfigs = strategyConfigsRes.data ?? []
  const advisorLineItems = advisorLineItemsRes.data ?? []

  // Health score (server-provided for consistency across advisor contexts)
  const scoreToday = initialHealthScore ?? null
  const scoreLast = null
  const scoreDelta = null

  // Current estate from API response — handles both single object and array response
  let currentGrossEstate: number | null = null
  let currentTaxableEstate: number | null = null
  let currentEstimatedTax: number | null = null
  let cstBenefit: number | null = null
  let hasPortabilityGap: boolean | null = null
  let estimatedTaxState: number | null = null
  let estimatedTaxStateWithCst: number | null = null

  const compositionRow = Array.isArray(compositionData)
    ? compositionData.find((r: Record<string, unknown>) => r.source_role === 'consumer') ??
      compositionData[0]
    : compositionData

  if (compositionRow) {
    currentGrossEstate = Number(compositionRow.gross_estate ?? 0) || null
    currentTaxableEstate = Number(compositionRow.taxable_estate ?? 0) || null
    currentEstimatedTax = Number(compositionRow.estimated_tax ?? 0) || null
    cstBenefit = Number(compositionRow.cst_benefit ?? 0) || null
    hasPortabilityGap = compositionRow.has_portability_gap === true
    estimatedTaxState = Number(compositionRow.estimated_tax_state ?? 0) || null
    estimatedTaxStateWithCst = Number(compositionRow.estimated_tax_state_with_cst ?? 0) || null
  }

  // At-death projection from saved scenario
  let grossEstate: number | null = null
  let estateTax: number | null = null
  let netToHeirs: number | null = null
  let costOfInaction: number | null = null

  if (projection?.outputs_s1_first) {
    const outputs = projection.outputs_s1_first as Record<string, number>[]
    const lastRow = outputs[outputs.length - 1]
    if (lastRow) {
      grossEstate = lastRow.estate_incl_home ?? null
      estateTax = (lastRow.estate_tax_federal ?? 0) + (lastRow.estate_tax_state ?? 0)
      netToHeirs = lastRow.net_to_heirs ?? null
      costOfInaction = estateTax
    }
  }

  const baseBrief: MeetingBrief = {
    client_name: clientName,
    health_score_today: scoreToday,
    health_score_last_meeting: scoreLast,
    health_score_delta: scoreDelta,
    top_alerts: alerts,
    current_gross_estate: currentGrossEstate,
    current_taxable_estate: currentTaxableEstate,
    current_estimated_tax: currentEstimatedTax,
    estimated_tax_state: estimatedTaxState,
    estimated_tax_state_with_cst: estimatedTaxStateWithCst,
    cst_benefit: cstBenefit,
    cst_benefit_at_death: null,
    has_portability_gap: hasPortabilityGap,
    gross_estate: grossEstate,
    estate_tax: estateTax,
    net_to_heirs: netToHeirs,
    cost_of_inaction: costOfInaction,
    horizon_columns: [],
    at_death_label: null,
    recommended_strategies: strategyConfigs.map((sc) => {
      const lineItem = advisorLineItems.find((li) => li.strategy_source === sc.strategy_type)
      const label = sc.label ?? STRATEGY_LABELS[sc.strategy_type] ?? sc.strategy_type
      if (lineItem) {
        const amt = fmt(lineItem.amount)
        const conf =
          lineItem.confidence_level === 'illustrative' ? 'modeled' : lineItem.confidence_level
        return `${label} — ${amt} (${conf})`
      }
      return label
    }),
    last_note: lastNote?.content ?? null,
    last_note_date: lastNote?.created_at ?? null,
    has_projection: !!projection,
    generated_at: new Date().toISOString(),
  }

  return mergeHorizonBrief(baseBrief, advisorHorizons)
}

// ─── Meeting brief display ────────────────────────────────────────────────────

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MeetingPrep({
  clientId,
  householdId,
  clientName,
  advisorHorizons,
  initialHealthScore = null,
  initialBriefSeed = null,
  estateComposition = null,
  briefHydratedFromServer = false,
  estateReportPdfUrl = null,
}: Props) {
  const [brief, setBrief] = useState<MeetingBrief | null>(() => {
    if (!initialBriefSeed) return null
    return mergeHorizonBrief(buildBriefFromSeed(clientName, initialBriefSeed), advisorHorizons)
  })
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const buildBriefFromProps = () =>
    initialBriefSeed
      ? mergeHorizonBrief(buildBriefFromSeed(clientName, initialBriefSeed), advisorHorizons)
      : null

  useEffect(() => {
    if (!briefHydratedFromServer || !initialBriefSeed) return
    setBrief(buildBriefFromProps())
  }, [briefHydratedFromServer, initialBriefSeed, clientName, advisorHorizons])

  const handleGenerate = async () => {
    setOpen(true)
    if (briefHydratedFromServer && initialBriefSeed) {
      setBrief(buildBriefFromProps())
      return
    }
    if (!brief && initialBriefSeed) {
      setBrief(buildBriefFromProps())
    }
    setLoading(true)
    const b = await generateMeetingBrief(
      clientId,
      householdId,
      clientName,
      initialHealthScore,
      advisorHorizons,
      estateComposition,
    )
    setBrief((prev) => ({
      ...b,
      cst_benefit_at_death:
        b.cst_benefit_at_death ??
        prev?.cst_benefit_at_death ??
        initialBriefSeed?.cst_benefit_at_death ??
        null,
    }))
    setLoading(false)
  }

  const handleRefreshBrief = async () => {
    setOpen(true)
    setLoading(true)
    const b = await generateMeetingBrief(
      clientId,
      householdId,
      clientName,
      initialHealthScore,
      advisorHorizons,
      estateComposition,
    )
    setBrief((prev) => ({
      ...b,
      cst_benefit_at_death:
        b.cst_benefit_at_death ??
        prev?.cst_benefit_at_death ??
        initialBriefSeed?.cst_benefit_at_death ??
        null,
    }))
    setLoading(false)
  }

  const handlePrint = () => window.print()

  const handleShareWithClient = async () => {
    setSharing(true)
    setShareMessage(null)
    try {
      const res = await fetch('/api/advisor/share-meeting-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')
      setShareMessage('Brief sent to your client by email.')
    } catch (err) {
      setShareMessage(err instanceof Error ? err.message : 'Failed to send brief.')
    } finally {
      setSharing(false)
    }
  }

  const hasCurrentData = brief &&
    (brief.current_gross_estate !== null ||
      brief.current_taxable_estate !== null ||
      brief.current_estimated_tax !== null)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          className="px-3 py-1.5 text-sm border border-[color:var(--mwm-border)] rounded-lg text-[color:var(--mwm-navy)] hover:bg-[var(--mwm-gold-pale)] font-medium transition"
        >
          📋 Prepare for Meeting
        </button>
        {estateReportPdfUrl && (
          <a
            href={estateReportPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-[#1a1a2e] text-white rounded-lg hover:bg-[#2d2d4e] font-medium transition"
          >
            Export estate report (PDF)
          </a>
        )}
        {briefHydratedFromServer && (
          <button
            type="button"
            onClick={handleRefreshBrief}
            className="px-3 py-1.5 text-sm text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
          >
            Refresh from latest data
          </button>
        )}
        {brief && (
          <button
            type="button"
            onClick={() => void handleShareWithClient()}
            disabled={sharing}
            className="px-3 py-1.5 text-sm text-[color:var(--mwm-navy)] border border-[color:var(--mwm-border)] rounded-lg hover:bg-[var(--mwm-gold-pale)] font-medium transition disabled:opacity-50"
          >
            {sharing ? 'Sending…' : 'Email brief to client'}
          </button>
        )}
      </div>
      {shareMessage && (
        <p className="text-sm text-neutral-600 mt-2">{shareMessage}</p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:p-8 overflow-y-auto print:inset-0 print:bg-white print:p-0">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl print:shadow-none print:rounded-none">
            {/* Header */}
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between print:border-b-2 print:border-neutral-300">
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide">Meeting Brief</p>
                <h2 className="text-lg font-bold text-neutral-900 mt-0.5">{clientName}</h2>
                {brief && (
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Generated {fmtDate(brief.generated_at)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button type="button" onClick={handlePrint}
                  className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareWithClient()}
                  disabled={sharing}
                  className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
                >
                  {sharing ? 'Sending…' : 'Email to client'}
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 text-xl leading-none px-2">
                  ×
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-[color:var(--mwm-border)] border-t-[color:var(--mwm-navy)] rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">Assembling meeting brief…</p>
                </div>
              </div>
            ) : brief ? (
              <div className="p-6 space-y-4">
                {/* Health score */}
                <BriefSection title="Estate Readiness Score">
                  {brief.health_score_today != null ? (
                    <>
                      <HealthScoreBadge
                        size="card"
                        score={brief.health_score_today}
                        showDelta
                        delta={brief.health_score_delta}
                      />
                      <p className="text-sm text-neutral-600 mt-2">
                        {scoreContextSentenceForAdvisor(brief.health_score_today, brief.client_name)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      Health score not yet calculated for this client.
                    </p>
                  )}
                </BriefSection>

                {/* Top alerts */}
                {brief.top_alerts.length > 0 && (
                  <BriefSection title={`Top Alerts (${brief.top_alerts.length})`}>
                    <div className="space-y-2">
                      {brief.top_alerts.map((alert, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${
                            alert.severity === 'high' || alert.severity === 'critical'
                              ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {alert.severity}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-neutral-800">{alert.title}</p>
                            <p className="text-xs text-neutral-500 mt-0.5">{alert.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </BriefSection>
                )}

                {/* Estate snapshot — current + at-death (projection) */}
                <BriefSection title="Estate Snapshot">
                  {hasCurrentData ? (
                    <div className="space-y-4">
                      {/* Current estate */}
                      <div>
                        <p className="text-xs text-neutral-400 mb-2 font-medium uppercase tracking-wide">
                          Current Estate
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: 'Gross Estate', value: brief.current_gross_estate ? fmt(brief.current_gross_estate) : '—' },
                            { label: 'Taxable Estate', value: brief.current_taxable_estate ? fmt(brief.current_taxable_estate) : '—' },
                            { label: 'Est. Tax (current)', value: brief.current_estimated_tax !== null ? fmt(brief.current_estimated_tax) : '—', red: true },
                          ].map((item) => (
                            <div key={item.label} className="text-center">
                              <div className={`text-lg font-bold ${item.red ? 'text-red-600' : 'text-neutral-900'}`}>
                                {item.value}
                              </div>
                              <div className="text-xs text-neutral-400 mt-0.5">{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {brief.cst_benefit !== null && brief.cst_benefit > 0 && (
                        <div className="rounded-lg bg-[var(--mwm-sage-pale)] border border-[color:var(--mwm-sage-pale)] px-4 py-3">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-[color:var(--mwm-sage)] text-base mt-0.5">💡</span>
                            <div>
                              <p className="text-sm font-semibold text-[color:var(--mwm-sage)]">
                                Credit Shelter Trust Opportunity
                              </p>
                              <p className="text-xs text-[color:var(--mwm-sage)] mt-0.5">
                                A Credit Shelter Trust could save{' '}
                                <strong>{fmt(brief.cst_benefit)}</strong> in state estate tax
                                for this household.
                              </p>
                              {brief.cst_benefit_at_death !== null && brief.cst_benefit_at_death > 0 && (
                                <p className="text-xs text-[color:var(--mwm-sage)] mt-0.5">
                                  At projected death year: <strong>{fmt(brief.cst_benefit_at_death)}</strong>
                                </p>
                              )}
                            </div>
                          </div>
                          {brief.estimated_tax_state !== null && brief.estimated_tax_state_with_cst !== null && (
                            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[color:var(--mwm-sage-pale)]">
                              <div className="text-center">
                                <p className="text-xs text-[color:var(--mwm-sage)] mb-1">Without CST</p>
                                <p className="text-sm font-bold text-red-600">
                                  {fmt(brief.estimated_tax_state)}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-[color:var(--mwm-sage)] mb-1">With CST</p>
                                <p className="text-sm font-bold text-[color:var(--mwm-sage)]">
                                  {fmt(brief.estimated_tax_state_with_cst)}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-[color:var(--mwm-sage)] mb-1">Savings</p>
                                <p className="text-sm font-bold text-[color:var(--mwm-sage)]">
                                  {fmt(brief.cst_benefit)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {brief.horizon_columns.length > 0 && (
                        <div className="border-t border-neutral-100 pt-3">
                          <p className="text-xs text-neutral-400 mb-2 font-medium uppercase tracking-wide">
                            Tax Horizons (Strategy engine)
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {brief.horizon_columns.map((col) => (
                              <div
                                key={col.label}
                                className="rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-2 text-center"
                              >
                                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide truncate">
                                  {col.label}
                                </p>
                                <p className="text-sm font-bold text-neutral-900 mt-1">
                                  {col.grossEstate !== null ? fmt(col.grossEstate) : '—'}
                                </p>
                                <p className="text-[10px] text-neutral-400">Gross</p>
                                <p className="text-sm font-semibold text-red-600 mt-1">
                                  {col.totalTax !== null ? fmt(col.totalTax) : '—'}
                                </p>
                                <p className="text-[10px] text-neutral-400">Est. tax</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-neutral-400 mt-2">
                            Same estimates as Strategy tab horizons (federal + state).
                          </p>
                        </div>
                      )}

                      {/* At-death projection */}
                      {brief.has_projection && (
                        <div className="border-t border-neutral-100 pt-3">
                          <p className="text-xs text-neutral-400 mb-2 font-medium uppercase tracking-wide">
                            {brief.at_death_label ? `${brief.at_death_label} (summary)` : 'At Death (Projected)'}
                          </p>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { label: 'Gross Estate', value: brief.gross_estate ? fmt(brief.gross_estate) : '—' },
                              { label: 'Est. Tax', value: brief.estate_tax !== null ? fmt(brief.estate_tax) : '—', red: true },
                              { label: 'Net to Heirs', value: brief.net_to_heirs ? fmt(brief.net_to_heirs) : '—', green: true },
                            ].map((item) => (
                              <div key={item.label} className="text-center">
                                <div className={`text-base font-semibold ${item.red ? 'text-red-500' : item.green ? 'text-green-600' : 'text-neutral-700'}`}>
                                  {item.value}
                                </div>
                                <div className="text-xs text-neutral-400 mt-0.5">{item.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : brief.has_projection ? (
                    // Fallback: composition API fetch failed, show projection only
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Gross Estate', value: brief.gross_estate ? fmt(brief.gross_estate) : '—' },
                        { label: 'Est. Tax', value: brief.estate_tax !== null ? fmt(brief.estate_tax) : '—', red: true },
                        { label: 'Net to Heirs', value: brief.net_to_heirs ? fmt(brief.net_to_heirs) : '—', green: true },
                      ].map((item) => (
                        <div key={item.label} className="text-center">
                          <div className={`text-lg font-bold ${item.red ? 'text-red-600' : item.green ? 'text-green-600' : 'text-neutral-900'}`}>
                            {item.value}
                          </div>
                          <div className="text-xs text-neutral-400 mt-0.5">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm text-neutral-400">No estate data available yet.</p>
                      <Link href={`/advisor/clients/${clientId}?tab=strategy`}
                        className="text-xs text-[color:var(--mwm-navy)] hover:underline mt-1 inline-block">
                        Run a projection in StrategyTab →
                      </Link>
                    </div>
                  )}
                </BriefSection>

                {/* Cost of inaction */}
                {brief.cost_of_inaction !== null && brief.cost_of_inaction > 0 && (
                  <BriefSection title="Cost of Inaction">
                    <p className="text-sm text-neutral-600">
                      Without additional planning, the projected estate tax liability is{' '}
                      <strong className="text-neutral-900">{fmt(brief.cost_of_inaction)}</strong>.
                      Strategy options are available in the{' '}
                      <Link href={`/advisor/clients/${clientId}?tab=strategy`} className="text-[color:var(--mwm-navy)] hover:underline">
                        Strategy tab
                      </Link>.
                    </p>
                  </BriefSection>
                )}

                {brief.recommended_strategies.length > 0 && (
                  <BriefSection title={`Recommended Strategies (${brief.recommended_strategies.length})`}>
                    <ul className="space-y-1.5">
                      {brief.recommended_strategies.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--mwm-navy-light)] shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-neutral-400">
                      Review implementation details with the client in the{' '}
                      <Link href={`/advisor/clients/${clientId}?tab=strategy`} className="text-[color:var(--mwm-navy)] hover:underline">
                        Strategy tab
                      </Link>.
                    </p>
                  </BriefSection>
                )}

                {/* Last advisor note */}
                {brief.last_note && (
                  <BriefSection title={`Last Note${brief.last_note_date ? ` — ${fmtDate(brief.last_note_date)}` : ''}`}>
                    <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {brief.last_note.substring(0, 500)}
                      {brief.last_note.length > 500 ? '…' : ''}
                    </p>
                  </BriefSection>
                )}

                <DisclaimerBanner context="meeting preparation" />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
