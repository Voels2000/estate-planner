// Sprint 62 — Meeting Preparation Mode
// Session 33: Estate Snapshot now shows current estate via /api/estate-composition.
// Falls back to projection at-death row if composition fetch is unavailable.

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'

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
  has_portability_gap?: boolean | null
  gross_estate?: number | null
  estate_tax?: number | null
  net_to_heirs?: number | null
  cost_of_inaction?: number | null
  recommended_strategies?: string[]
  last_note?: string | null
  last_note_date?: string | null
  has_projection?: boolean
}

interface Props {
  clientId: string
  householdId: string
  clientName: string
  initialHealthScore?: number | null
  initialBriefSeed?: MeetingBriefSeed | null
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
    has_portability_gap: seed.has_portability_gap ?? null,
    gross_estate: seed.gross_estate ?? null,
    estate_tax: seed.estate_tax ?? null,
    net_to_heirs: seed.net_to_heirs ?? null,
    cost_of_inaction: seed.cost_of_inaction ?? null,
    recommended_strategies: seed.recommended_strategies ?? [],
    last_note: seed.last_note ?? null,
    last_note_date: seed.last_note_date ?? null,
    has_projection: seed.has_projection ?? false,
    generated_at: new Date().toISOString(),
  }
}

// ─── Meeting brief generator ──────────────────────────────────────────────────

async function generateMeetingBrief(
  clientId: string,
  householdId: string,
  clientName: string,
  initialHealthScore?: number | null,
): Promise<MeetingBrief> {
  const supabase = createClient()

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
    // Current estate composition via API (matches consumer flow/classifyEstateAssets)
    fetch('/api/estate-composition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        householdId,
        sourceRole: 'consumer',
      }),
    })
      .then(async (res) => (res.ok ? await res.json() : null))
      .catch(() => null),
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

  return {
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
    has_portability_gap: hasPortabilityGap,
    gross_estate: grossEstate,
    estate_tax: estateTax,
    net_to_heirs: netToHeirs,
    cost_of_inaction: costOfInaction,
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
  initialHealthScore = null,
  initialBriefSeed = null,
}: Props) {
  const [brief, setBrief] = useState<MeetingBrief | null>(
    initialBriefSeed ? buildBriefFromSeed(clientName, initialBriefSeed) : null,
  )
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleGenerate = async () => {
    setOpen(true)
    if (!brief && initialBriefSeed) {
      setBrief(buildBriefFromSeed(clientName, initialBriefSeed))
    }
    setLoading(true)
    const b = await generateMeetingBrief(clientId, householdId, clientName, initialHealthScore)
    setBrief(b)
    setLoading(false)
  }

  const handlePrint = () => window.print()

  const hasCurrentData = brief &&
    (brief.current_gross_estate !== null ||
      brief.current_taxable_estate !== null ||
      brief.current_estimated_tax !== null)

  return (
    <>
      <button
        type="button"
        onClick={handleGenerate}
        className="px-3 py-1.5 text-sm border border-indigo-200 rounded-lg text-indigo-600 hover:bg-indigo-50 font-medium transition"
      >
        📋 Prepare for Meeting
      </button>

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
                <button type="button" onClick={() => setOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 text-xl leading-none px-2">
                  ×
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">Assembling meeting brief…</p>
                </div>
              </div>
            ) : brief ? (
              <div className="p-6 space-y-4">
                {/* Health score */}
                <BriefSection title="Estate Readiness Score">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-neutral-900">
                        {brief.health_score_today ?? '—'}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">Today</div>
                    </div>
                    {brief.health_score_delta !== null && (
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${brief.health_score_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {brief.health_score_delta >= 0 ? '+' : ''}{brief.health_score_delta}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">vs last meeting</div>
                      </div>
                    )}
                  </div>
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
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-emerald-500 text-base mt-0.5">💡</span>
                            <div>
                              <p className="text-sm font-semibold text-emerald-800">
                                Credit Shelter Trust Opportunity
                              </p>
                              <p className="text-xs text-emerald-700 mt-0.5">
                                A Credit Shelter Trust could save{' '}
                                <strong>{fmt(brief.cst_benefit)}</strong> in state estate tax
                                for this household.
                              </p>
                            </div>
                          </div>
                          {brief.estimated_tax_state !== null && brief.estimated_tax_state_with_cst !== null && (
                            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-emerald-200">
                              <div className="text-center">
                                <p className="text-xs text-emerald-600 mb-1">Without CST</p>
                                <p className="text-sm font-bold text-red-600">
                                  {fmt(brief.estimated_tax_state)}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-emerald-600 mb-1">With CST</p>
                                <p className="text-sm font-bold text-emerald-700">
                                  {fmt(brief.estimated_tax_state_with_cst)}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-emerald-600 mb-1">Savings</p>
                                <p className="text-sm font-bold text-emerald-800">
                                  {fmt(brief.cst_benefit)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* At-death projection */}
                      {brief.has_projection && (
                        <div className="border-t border-neutral-100 pt-3">
                          <p className="text-xs text-neutral-400 mb-2 font-medium uppercase tracking-wide">
                            At Death (Projected)
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
                      <Link href={`/advisor/clients/${clientId}`}
                        className="text-xs text-indigo-600 hover:underline mt-1 inline-block">
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
                      Strategy options are available in the StrategyTab.
                    </p>
                  </BriefSection>
                )}

                {brief.recommended_strategies.length > 0 && (
                  <BriefSection title={`Recommended Strategies (${brief.recommended_strategies.length})`}>
                    <ul className="space-y-1.5">
                      {brief.recommended_strategies.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-neutral-400">
                      Review implementation details with the client in the Strategy tab.
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
