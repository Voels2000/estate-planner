'use client'

// Consumer strategy modeling and progress panel.
// Reads advisor-modeled hints, pre-populates assumptions from household context,
// and persists consumer save/progress state through `/api/strategy-line-items`.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AskAdvisorAboutStrategyButton } from '@/components/consumer/AskAdvisorAboutStrategyButton'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDollars, formatDollarsCompact } from '@/lib/utils/formatCurrency'
import { strategyLabel } from '@/lib/strategy/strategyLabels'
import { applyGRAT, GRATConfig } from '@/lib/strategy/applyGRAT'
import { applyCRT, applyCLAT } from '@/lib/strategy/applyCharitableStrategies'
import { analyzeLiquidity, LiquidityConfig } from '@/lib/strategy/analyzeLiquidity'
import { modelRothConversion, RothConversionConfig } from '@/lib/strategy/modelRothConversion'
import type { StrategyLineItemInput } from '@/lib/estate/types'
import { SlatStrategyForm, type SlatSavedRow } from '@/components/consumer/SlatStrategyForm'
import { IlitStrategyForm, type IlitSavedRow } from '@/components/consumer/IlitStrategyForm'
import {
  CharitableStrategyForm,
  type CharitableSavedRow,
} from '@/components/consumer/CharitableStrategyForm'
import { StrategySandboxSection } from '@/components/consumer/strategy/StrategySandboxSection'
import { StrategyConfirmedSection } from '@/components/consumer/strategy/StrategyConfirmedSection'
import {
  partitionStrategyLineItems,
  type StrategyLineItemRow,
} from '@/lib/consumer/strategyLineItemViews'

type AdvisorLineItem = {
  strategy_source: string
  amount: number
  sign: number
  confidence_level: string
  effective_year: number | null
  metadata: Record<string, unknown> | null
}

type AdvancedPanel =
  | 'grat'
  | 'crt'
  | 'clat'
  | 'daf'
  | 'liquidity'
  | 'roth'
  | 'slat'
  | 'ilit'
  | null

type FilingStatus = 'single' | 'married_joint'

function isMfjFiling(filing: string): boolean {
  return filing === 'mfj' || filing === 'married_joint'
}

function filingForStrategyContext(filingStatus: FilingStatus): string {
  return filingStatus === 'married_joint' ? 'mfj' : 'single'
}

const STRATEGY_INFO: Record<
  string,
  {
    fullName: string
    description: string
    bestFor: string
    contextNote: (ctx: EstateContext, filing: string) => string | null
  }
> = {
  grat: {
    fullName: 'Grantor Retained Annuity Trust',
    description:
      'Transfers future appreciation on assets out of your estate while you retain an annuity stream for a fixed term.',
    bestFor: 'High-growth assets, business interests, concentrated positions',
    contextNote: (ctx) =>
      ctx.illiquidAssets > 0
        ? `Your estate has ${formatDollarsCompact(ctx.illiquidAssets)} in illiquid assets that may be good candidates.`
        : null,
  },
  crt: {
    fullName: 'Charitable Remainder Trust',
    description:
      'You receive an income stream now; the remaining assets pass to charity at death with an immediate tax deduction.',
    bestFor: 'Appreciated assets with charitable intent',
    contextNote: (ctx) =>
      ctx.grossEstate > 0 ? 'Most effective for highly appreciated assets you would otherwise sell.' : null,
  },
  clat: {
    fullName: 'Charitable Lead Annuity Trust',
    description:
      'Charity receives an annuity now; heirs receive the remainder after the trust term, often with reduced gift tax.',
    bestFor: 'MFJ estates with strong charitable goals',
    contextNote: (_ctx, filing) =>
      !isMfjFiling(filing) ? 'Most commonly used by married couples.' : null,
  },
  daf: {
    fullName: 'Donor Advised Fund',
    description:
      'Take an immediate charitable deduction and recommend grants to charities over time.',
    bestFor: 'High-income years, appreciated securities, bunching deductions',
    contextNote: () =>
      'Contributions of appreciated securities avoid capital gains and qualify for a full FMV deduction.',
  },
  liquidity: {
    fullName: 'Liquidity Planning',
    description:
      'Ensures your estate has sufficient liquid assets to pay taxes and settlement costs without forced sales.',
    bestFor: 'Estates with significant illiquid holdings',
    contextNote: (ctx) => {
      const illiquidPct =
        ctx.grossEstate > 0 ? Math.round((ctx.illiquidAssets / ctx.grossEstate) * 100) : 0
      return illiquidPct > 50
        ? `Your estate is ${illiquidPct}% illiquid — liquidity planning is highly relevant.`
        : null
    },
  },
  roth: {
    fullName: 'Roth Conversion',
    description:
      'Convert pre-tax retirement assets to Roth, paying tax now to eliminate RMDs and create tax-free growth.',
    bestFor: 'Income gap years before RMDs, estates expecting higher future tax rates',
    contextNote: (ctx) =>
      ctx.preIRABalance > 0
        ? `You have ${formatDollarsCompact(ctx.preIRABalance)} in pre-tax retirement assets eligible for conversion.`
        : null,
  },
  slat: {
    fullName: 'Spousal Lifetime Access Trust',
    description:
      'Removes assets from your taxable estate while your spouse retains access to the trust assets.',
    bestFor: 'MFJ households looking to use lifetime exemption now',
    contextNote: (ctx, filing) =>
      !isMfjFiling(filing)
        ? 'Available for married couples only.'
        : ctx.federalExemption > ctx.grossEstate
          ? `You have ${formatDollarsCompact(ctx.federalExemption - ctx.grossEstate)} of exemption available to shelter SLAT contributions.`
          : null,
  },
  ilit: {
    fullName: 'Irrevocable Life Insurance Trust',
    description:
      'Holds life insurance outside your taxable estate so the death benefit passes to heirs free of estate tax.',
    bestFor: 'Estates with significant life insurance',
    contextNote: (ctx) =>
      ctx.grossEstate > 0
        ? 'Life insurance owned personally is included in your taxable estate — an ILIT removes it.'
        : null,
  },
}

function StrategyEducationCard({
  panelId,
  ctx,
  filingStatus,
  defaultOpen = true,
  userRole = 'consumer',
}: {
  panelId: string
  ctx: EstateContext
  filingStatus: FilingStatus
  defaultOpen?: boolean
  userRole?: 'consumer' | 'advisor'
}) {
  const info = STRATEGY_INFO[panelId]
  if (!info) return null
  const filing = filingForStrategyContext(filingStatus)
  const contextNote = info.contextNote(ctx, filing)

  return (
    <details className="mb-4 rounded-lg border border-neutral-200 bg-white" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-neutral-800 [&::-webkit-details-marker]:hidden">
        About this strategy
      </summary>
      <div className="space-y-2 border-t border-neutral-100 px-4 pb-4 pt-3">
        <p className="text-sm font-medium text-neutral-900">{info.fullName}</p>
        <p className="text-sm text-neutral-600">{info.description}</p>
        <p className="text-xs text-neutral-500">
          <span className="font-medium">Best for: </span>
          {info.bestFor}
        </p>
        {contextNote && (
          <p className="text-xs font-medium text-amber-600">{contextNote}</p>
        )}
        {userRole === 'consumer' && (
          <AskAdvisorAboutStrategyButton
            strategyName={info.fullName}
            strategyType={panelId}
          />
        )}
      </div>
    </details>
  )
}

type ConsumerStatus = 'not_started' | 'in_progress' | 'complete'

// ─── Estate context prop ──────────────────────────────────────────────────────
// Replaces all hardcoded DEFAULT_* constants. Passed from the page server component.

export interface EstateContext {
  grossEstate: number
  federalExemption: number
  estimatedFederalTax: number
  estimatedStateTax: number
  person1BirthYear: number
  /** Liquid assets = financial assets that are liquid */
  liquidAssets: number
  /** Illiquid assets = real estate + businesses + illiquid financial */
  illiquidAssets: number
  /** Pre-tax IRA/401k balance for Roth modeling */
  preIRABalance: number
  /** Current Roth balance */
  rothBalance: number
  /** Annual RMD if already in distribution */
  annualRMD: number
}

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_7520_RATE = 0.052

// Fallback used only when estateContext is not provided (should not happen in prod)
const FALLBACK_CONTEXT: EstateContext = {
  grossEstate: 5_000_000,
  federalExemption: 13_990_000,
  estimatedFederalTax: 0,
  estimatedStateTax: 0,
  person1BirthYear: CURRENT_YEAR - 50,
  liquidAssets: 1_500_000,
  illiquidAssets: 3_500_000,
  preIRABalance: 0,
  rothBalance: 0,
  annualRMD: 0,
}

interface ConsumerStrategyPanelProps {
  householdId: string
  userRole: 'consumer' | 'advisor'
  advisorLineItems?: AdvisorLineItem[]
  /** Real household data — replaces hardcoded defaults */
  estateContext?: EstateContext
  /** Household filing status for strategy relevance (e.g. SLAT requires MFJ). */
  filingStatus?: FilingStatus
  /** Household owner user id — insurance policies use user_id. */
  ownerUserId?: string
  /** Server-prefetched consumer saved strategies — skips mount Supabase fetch when provided */
  initialConsumerSaved?: InitialConsumerSavedState
  /** Server-prefetched active strategy rows — skips mount fetch when provided */
  initialStrategyRows?: StrategyLineItemRow[]
  /** Server-prefetched withdrawn strategy rows */
  initialWithdrawnRows?: WithdrawnStrategyRow[]
}

export type InitialConsumerSavedState = {
  savedSources: string[]
  savedDetails: Record<string, SavedStrategyDetail>
  statuses: Record<string, ConsumerStatus>
}

type WithdrawnStrategyRow = {
  id: string
  strategy_source: string
  amount: number | null
  scenario_name: string | null
  reversed_from: string | null
  reversal_reason: string | null
  withdrawn_at: string | null
}

export type SavedStrategyDetail = {
  amount: number
  metadata: Record<string, unknown> | null
}

const CONFIDENCE_DISPLAY: Record<string, string> = {
  illustrative: 'Modeled',
  probable: 'Probable',
  committed: 'Committed',
}

const STATUS_LABELS: Record<ConsumerStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
}

const STATUS_NEXT: Record<ConsumerStatus, ConsumerStatus> = {
  not_started: 'in_progress',
  in_progress: 'complete',
  complete: 'not_started',
}

const STATUS_COLORS: Record<ConsumerStatus, string> = {
  not_started: 'text-gray-500 border-gray-200 bg-white',
  in_progress: 'text-blue-700 border-blue-200 bg-blue-50',
  complete: 'text-green-700 border-green-200 bg-green-50',
}

async function writeStrategyLineItem(input: StrategyLineItemInput) {
  const lineRes = await fetch('/api/strategy-line-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, source_role: input.source_role ?? 'consumer' }),
  })
  void lineRes
}

async function removeStrategyLineItem(householdId: string, strategySource: string) {
  await fetch('/api/strategy-line-items', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ householdId, strategySource }),
  })
}

async function updateStrategyStatus(
  householdId: string,
  strategySource: string,
  status: ConsumerStatus,
) {
  await fetch('/api/strategy-line-items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ householdId, strategySource, consumer_status: status }),
  })
}

function useRecommendAdvanced(
  householdId: string,
  initialConsumerSaved?: InitialConsumerSavedState,
) {
  const hasInitial = initialConsumerSaved !== undefined
  const [saved, setSaved] = useState<Set<string>>(
    () => new Set(hasInitial ? initialConsumerSaved!.savedSources : []),
  )
  const [savedDetails, setSavedDetails] = useState<Record<string, SavedStrategyDetail>>(
    () => (hasInitial ? initialConsumerSaved!.savedDetails : {}),
  )
  const [saving, setSaving] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, ConsumerStatus>>(
    () => (hasInitial ? initialConsumerSaved!.statuses : {}),
  )
  const [loadingInitial, setLoadingInitial] = useState(!hasInitial)

  const loadSaved = useCallback(async () => {
    if (!householdId) {
      setLoadingInitial(false)
      return
    }
    const supabase = createClient()
    const { data } = await supabase
      .from('strategy_line_items')
      .select('strategy_source, consumer_status, amount, metadata, scenario_name')
      .eq('household_id', householdId)
      .eq('source_role', 'consumer')
      .eq('is_active', true)

    if (data && data.length > 0) {
      const savedSet = new Set<string>()
      const statusMap: Record<string, ConsumerStatus> = {}
      const detailMap: Record<string, SavedStrategyDetail> = {}
      for (const row of data) {
        const source = row.strategy_source as string
        savedSet.add(source)
        statusMap[source] = (row.consumer_status as ConsumerStatus) ?? 'not_started'
        detailMap[source] = {
          amount: Number(row.amount ?? 0),
          metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        }
      }
      setSaved(savedSet)
      setStatuses(statusMap)
      setSavedDetails(detailMap)
    } else {
      setSaved(new Set())
      setStatuses({})
      setSavedDetails({})
    }
    setLoadingInitial(false)
  }, [householdId])

  useEffect(() => {
    if (initialConsumerSaved !== undefined) {
      setSaved(new Set(initialConsumerSaved.savedSources))
      setSavedDetails(initialConsumerSaved.savedDetails)
      setStatuses(initialConsumerSaved.statuses)
      setLoadingInitial(false)
      return
    }
    void loadSaved()
  }, [initialConsumerSaved, loadSaved])

  async function toggle(
    strategySource: string,
    lineItemInput: Omit<StrategyLineItemInput, 'household_id'>,
  ) {
    setSaving(true)
    const isActive = saved.has(strategySource)
    if (isActive) {
      await removeStrategyLineItem(householdId, strategySource)
    } else {
      await writeStrategyLineItem({ ...lineItemInput, household_id: householdId })
    }
    setSaved((prev) => {
      const next = new Set(prev)
      if (isActive) {
        next.delete(strategySource)
        setStatuses((s) => {
          const ns = { ...s }
          delete ns[strategySource]
          return ns
        })
      } else {
        next.add(strategySource)
        setStatuses((s) => ({ ...s, [strategySource]: 'not_started' }))
      }
      return next
    })
    setSaving(false)
  }

  async function cycleStatus(strategySource: string) {
    const current = statuses[strategySource] ?? 'not_started'
    const next = STATUS_NEXT[current]
    setStatuses((s) => ({ ...s, [strategySource]: next }))
    await updateStrategyStatus(householdId, strategySource, next)
  }

  return { saved, savedDetails, saving, toggle, statuses, cycleStatus, loadingInitial, reloadSaved: loadSaved }
}

// ─── Advisor hint banner ──────────────────────────────────────────────────────

function AdvisorHintBanner({
  advisorLineItems,
  strategySource,
}: {
  advisorLineItems: AdvisorLineItem[]
  strategySource: string
}) {
  const item = advisorLineItems.find((i) => i.strategy_source === strategySource)
  if (!item) return null
  const confLabel = CONFIDENCE_DISPLAY[item.confidence_level] ?? item.confidence_level
  const amtLabel = item.amount > 0 ? ` — $${Math.round(item.amount).toLocaleString()}` : ''
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--mwm-gold-pale)] border border-[color:var(--mwm-border)] rounded-lg text-xs text-[color:var(--mwm-navy)]">
      <span className="font-semibold shrink-0">Advisor modeled:</span>
      <span>{confLabel}{amtLabel}</span>
    </div>
  )
}

// ─── Recommend + status button row ───────────────────────────────────────────

function RecommendButton({
  strategySource, saved, saving, userRole, status, onToggle, onCycleStatus,
}: {
  strategySource: string
  saved: Set<string>
  saving: boolean
  userRole: 'consumer' | 'advisor'
  status: ConsumerStatus | undefined
  onToggle: () => void
  onCycleStatus: () => void
}) {
  const isRecommended = saved.has(strategySource)
  const label = userRole === 'advisor'
    ? 'Mark this strategy as recommended for client'
    : 'Save this strategy to your plan'

  return (
    <div className="pt-2 border-t border-gray-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        <button
          type="button"
          onClick={onToggle}
          disabled={saving}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isRecommended
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
          }`}
        >
          {isRecommended ? '✓ Saved' : 'Save strategy'}
        </button>
      </div>
      {isRecommended && userRole === 'consumer' && status !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Your progress</span>
          <button
            type="button"
            onClick={onCycleStatus}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${STATUS_COLORS[status]}`}
          >
            {STATUS_LABELS[status]} →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConsumerStrategyPanel({
  householdId,
  userRole,
  advisorLineItems = [],
  estateContext,
  filingStatus = 'single',
  ownerUserId,
  initialConsumerSaved,
  initialStrategyRows,
  initialWithdrawnRows,
}: ConsumerStrategyPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Use real data when provided, fall back gracefully if not
  const ctx = estateContext ?? FALLBACK_CONTEXT
  const mfjFiling = filingStatus === 'married_joint'
  const slatBlocked = !mfjFiling

  const grossEstate            = ctx.grossEstate
  const federalExemption       = ctx.federalExemption
  void federalExemption
  const estimatedFederalTax    = Math.round(ctx.estimatedFederalTax)
  const estimatedStateTax      = Math.round(ctx.estimatedStateTax)
  const person1BirthYear       = ctx.person1BirthYear
  const liquidAssets           = ctx.liquidAssets
  const illiquidAssets         = ctx.illiquidAssets
  const preIRABalance          = ctx.preIRABalance
  const rothBalance            = ctx.rothBalance
  const annualRMD              = ctx.annualRMD
  const advisorLineItemBySource = useMemo(
    () => new Map(advisorLineItems.map((item) => [item.strategy_source, item])),
    [advisorLineItems],
  )
  function advisorMeta(strategySource: string): Record<string, unknown> {
    return advisorLineItemBySource.get(strategySource)?.metadata ?? {}
  }
  function advisorAmount(strategySource: string): number {
    return advisorLineItemBySource.get(strategySource)?.amount ?? 0
  }

  const { saved, savedDetails, saving, toggle, statuses, cycleStatus, loadingInitial, reloadSaved } =
    useRecommendAdvanced(householdId, initialConsumerSaved)

  const hasInitialStrategyRows = initialStrategyRows !== undefined
  const [strategyRows, setStrategyRows] = useState<StrategyLineItemRow[]>(
    () => initialStrategyRows ?? [],
  )
  const [withdrawnRows, setWithdrawnRows] = useState<WithdrawnStrategyRow[]>(
    () => initialWithdrawnRows ?? [],
  )
  const [loadingStrategies, setLoadingStrategies] = useState(!hasInitialStrategyRows)

  const loadAllStrategyItems = useCallback(async () => {
    if (!householdId) {
      setStrategyRows([])
      setWithdrawnRows([])
      setLoadingStrategies(false)
      return
    }
    const supabase = createClient()
    const [activeRes, withdrawnRes] = await Promise.all([
      supabase
        .from('strategy_line_items')
        .select(
          'id, strategy_source, source_role, confidence_level, amount, scenario_name, consumer_accepted, consumer_rejected, effective_year',
        )
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('strategy_line_items')
        .select(
          'id, strategy_source, amount, scenario_name, reversed_from, reversal_reason, withdrawn_at',
        )
        .eq('household_id', householdId)
        .eq('consumer_withdrawn', true)
        .eq('is_active', false)
        .order('withdrawn_at', { ascending: false }),
    ])

    setStrategyRows(
      (activeRes.data ?? []).map((row) => ({
        id: row.id as string,
        strategy_source: row.strategy_source as string,
        source_role: row.source_role as 'consumer' | 'advisor',
        confidence_level: row.confidence_level as string,
        amount: row.amount != null ? Number(row.amount) : null,
        scenario_name: (row.scenario_name as string | null) ?? null,
        consumer_accepted: Boolean(row.consumer_accepted),
        consumer_rejected: Boolean(row.consumer_rejected),
        effective_year: row.effective_year as number | null,
      })),
    )
    setWithdrawnRows(
      (withdrawnRes.data ?? []).map((row) => ({
        id: row.id as string,
        strategy_source: row.strategy_source as string,
        amount: row.amount != null ? Number(row.amount) : null,
        scenario_name: (row.scenario_name as string | null) ?? null,
        reversed_from: (row.reversed_from as string | null) ?? null,
        reversal_reason: (row.reversal_reason as string | null) ?? null,
        withdrawn_at: (row.withdrawn_at as string | null) ?? null,
      })),
    )
    setLoadingStrategies(false)
  }, [householdId])

  useEffect(() => {
    if (initialStrategyRows !== undefined) {
      setStrategyRows(initialStrategyRows)
      setWithdrawnRows(initialWithdrawnRows ?? [])
      setLoadingStrategies(false)
      return
    }
    void loadAllStrategyItems()
  }, [initialStrategyRows, initialWithdrawnRows, loadAllStrategyItems])

  useEffect(() => {
    const open = searchParams.get('openPanel')
    if (!open) return
    const panelIds = ['grat', 'crt', 'clat', 'daf', 'liquidity', 'roth', 'slat', 'ilit'] as const
    if ((panelIds as readonly string[]).includes(open)) {
      setActivePanel(open as AdvancedPanel)
    }
  }, [searchParams])

  const { sandbox: sandboxStrategies, confirmed: confirmedStrategies } = useMemo(
    () => partitionStrategyLineItems(strategyRows),
    [strategyRows],
  )

  const sandboxSources = useMemo(
    () => new Set(sandboxStrategies.map((s) => s.strategy_source)),
    [sandboxStrategies],
  )
  const confirmedSources = useMemo(
    () => new Set(confirmedStrategies.map((s) => s.strategy_source)),
    [confirmedStrategies],
  )
  const advisorSandboxSources = useMemo(
    () =>
      new Set(
        sandboxStrategies.filter((s) => s.source_role === 'advisor').map((s) => s.strategy_source),
      ),
    [sandboxStrategies],
  )

  const refreshAfterStrategyWrite = useCallback(() => {
    void reloadSaved()
    void loadAllStrategyItems()
    router.refresh()
  }, [reloadSaved, loadAllStrategyItems, router])

  const handleModelToggle = useCallback(
    async (strategySource: string, lineItemInput: Omit<StrategyLineItemInput, 'household_id'>) => {
      await toggle(strategySource, lineItemInput)
      await loadAllStrategyItems()
      router.refresh()
    },
    [toggle, loadAllStrategyItems, router],
  )

  const slatSaved: SlatSavedRow | null = saved.has('slat')
    ? {
        amount: savedDetails.slat?.amount ?? 0,
        metadata: savedDetails.slat?.metadata ?? null,
      }
    : null

  const ilitSaved: IlitSavedRow | null = saved.has('ilit')
    ? {
        amount: savedDetails.ilit?.amount ?? 0,
        metadata: savedDetails.ilit?.metadata ?? null,
      }
    : null

  const charitableSaved: CharitableSavedRow | null = saved.has('daf')
    ? {
        amount: savedDetails.daf?.amount ?? 0,
        strategySource: 'daf',
        metadata: savedDetails.daf?.metadata ?? null,
      }
    : saved.has('charitable')
      ? {
          amount: savedDetails.charitable?.amount ?? 0,
          strategySource: 'charitable',
          metadata: savedDetails.charitable?.metadata ?? null,
        }
      : null

  const charitablePanelActive = saved.has('daf') || saved.has('charitable')

  const [activePanel, setActivePanel] = useState<AdvancedPanel>(null)
  const defaultDeathYear = person1BirthYear + 82

  // ── GRAT defaults ─────────────────────────────────────────────────────────
  // Funding amount: advisor override → 25% of gross estate (real data)
  const defaultGRATFunding = Number(
    advisorMeta('grat').funding_amount ?? Math.min(5_000_000, Math.round(grossEstate * 0.25)),
  )

  const [gratConfig, setGratConfig] = useState<GRATConfig>({
    fundingAmount: defaultGRATFunding,
    termYears: Number(advisorMeta('grat').term_years ?? 5),
    expectedGrowthRate: 0.08,
    section7520Rate: DEFAULT_7520_RATE,
    isZeroedOut: true,
    isRollingStrategy: false,
    numberOfRollingGRATs: 5,
    grantorAge: CURRENT_YEAR - person1BirthYear,
    deathYear: defaultDeathYear,
    establishmentYear: CURRENT_YEAR,
  })

  const [crtConfig, setCrtConfig] = useState({
    fundingAmount: advisorAmount('crt') > 0 ? advisorAmount('crt') : 1_000_000,
    payoutRate: 0.05,
    termYears: 20,
    section7520Rate: DEFAULT_7520_RATE,
    marginalIncomeTaxRate: 0.37,
    growthRate: 0.06,
  })

  const [clatConfig, setClatConfig] = useState({
    fundingAmount: advisorAmount('clat') > 0 ? advisorAmount('clat') : 2_000_000,
    annualCharitableAnnuity: 200_000,
    termYears: 10,
    section7520Rate: DEFAULT_7520_RATE,
    growthRate: 0.08,
    isZeroedOut: true,
  })

  // ── Liquidity defaults — use real estate composition ──────────────────────
  const [liquidityConfig, setLiquidityConfig] = useState<LiquidityConfig>({
    liquidAssets,
    illiquidAssets,
    estimatedFederalTax,
    estimatedStateTax,
    ilitDeathBenefit: 0,
    ilitSection2035Flag: false,
    otherLiquiditySources: 0,
  })

  // ── Roth defaults — use real IRA balances ─────────────────────────────────
  const [rothConfig, setRothConfig] = useState<RothConversionConfig>({
    preIRABalance,
    annualRMD,
    annualConversionAmount: Number(advisorMeta('roth').annual_conversion ?? 100_000),
    conversionYears: Number(advisorMeta('roth').years ?? 10),
    marginalTaxRateDuringConversion: 0.32,
    beneficiaryMarginalTaxRate: 0.37,
    growthRate: 0.07,
    discountRate: 0.05,
    yearsUntilDeath: defaultDeathYear - CURRENT_YEAR,
  })

  // Re-seed configs when estateContext changes (e.g. after async load)
  useEffect(() => {
    if (!estateContext) return
    const gratMeta = advisorLineItemBySource.get('grat')?.metadata ?? {}
    const timeoutId = window.setTimeout(() => {
      setGratConfig((c) => ({
        ...c,
        fundingAmount: Number(
          gratMeta.funding_amount ??
          Math.min(5_000_000, Math.round(estateContext.grossEstate * 0.25)),
        ),
        grantorAge: CURRENT_YEAR - estateContext.person1BirthYear,
        deathYear: estateContext.person1BirthYear + 82,
      }))
      setLiquidityConfig((c) => ({
        ...c,
        liquidAssets: estateContext.liquidAssets,
        illiquidAssets: estateContext.illiquidAssets,
        estimatedFederalTax: Math.round(estateContext.estimatedFederalTax),
        estimatedStateTax: Math.round(estateContext.estimatedStateTax),
      }))
      setRothConfig((c) => ({
        ...c,
        preIRABalance: estateContext.preIRABalance,
        annualRMD: estateContext.annualRMD,
        yearsUntilDeath: estateContext.person1BirthYear + 82 - CURRENT_YEAR,
      }))
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [advisorLineItemBySource, estateContext])

  const PANELS = [
    { id: 'grat' as AdvancedPanel, label: 'GRAT' },
    { id: 'crt' as AdvancedPanel, label: 'CRT' },
    { id: 'clat' as AdvancedPanel, label: 'CLAT' },
    { id: 'daf' as AdvancedPanel, label: 'DAF' },
    { id: 'liquidity' as AdvancedPanel, label: 'Liquidity' },
    { id: 'roth' as AdvancedPanel, label: 'Roth Conversion' },
    { id: 'slat' as AdvancedPanel, label: 'SLAT' },
    { id: 'ilit' as AdvancedPanel, label: 'ILIT' },
  ]

  const gratResult     = activePanel === 'grat'      ? applyGRAT(gratConfig) : null
  const crtResult      = activePanel === 'crt'       ? applyCRT(crtConfig) : null
  const clatResult     = activePanel === 'clat'      ? applyCLAT(clatConfig) : null
  const liquidityResult = activePanel === 'liquidity'
    ? analyzeLiquidity({ ...liquidityConfig, estimatedFederalTax, estimatedStateTax })
    : null
  const rothResult     = activePanel === 'roth'      ? modelRothConversion(rothConfig) : null

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

  if (loadingInitial || loadingStrategies) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">Loading your saved strategies…</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-gray-700">Transfer Strategies</h3>
      </div>

      <div>
        <div className="mb-3 border-l-4 border-amber-400 pl-3">
          <h4 className="text-sm font-semibold text-[color:var(--mwm-navy)]">Sandbox</h4>
          <p className="mt-0.5 text-xs text-gray-400">
            Strategies you&apos;re exploring — not yet in your plan
          </p>
        </div>
        <StrategySandboxSection
          householdId={householdId}
          items={sandboxStrategies}
          onAction={refreshAfterStrategyWrite}
        />
      </div>

      <div>
        <div className="mb-3 border-l-4 border-green-400 pl-3">
          <h4 className="text-sm font-semibold text-[color:var(--mwm-navy)]">In My Plan</h4>
          <p className="mt-0.5 text-xs text-gray-400">
            Confirmed strategies reducing your taxable estate
          </p>
        </div>
        <StrategyConfirmedSection
          items={confirmedStrategies}
          onRefresh={refreshAfterStrategyWrite}
        />
      </div>

      {withdrawnRows.length > 0 && (
        <details className="rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-gray-400 transition-colors hover:text-gray-600">
            Strategy history ({withdrawnRows.length})
          </summary>
          <div className="mt-3 space-y-2">
            {withdrawnRows.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between rounded-lg border border-gray-100 bg-white/80 px-4 py-3 opacity-80"
              >
                <div>
                  <p className="text-sm text-gray-600">
                    {strategyLabel(item.strategy_source, item.scenario_name)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {item.amount != null && item.amount > 0 ? formatDollars(item.amount) : null}
                    {item.reversed_from ? ` · Was ${item.reversed_from}` : ''}
                    {item.withdrawn_at
                      ? ` · Withdrawn ${new Date(item.withdrawn_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`
                      : ''}
                  </p>
                  {item.reversal_reason && (
                    <p className="mt-0.5 text-xs italic text-gray-400">
                      &ldquo;{item.reversal_reason}&rdquo;
                    </p>
                  )}
                </div>
                <span className="ml-3 shrink-0 text-[10px] text-gray-400">Withdrawn</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="border-t border-gray-100 pt-6">
        <p className="mb-4 text-xs text-gray-400">
          Model a strategy below to explore its impact, then add it to your plan.
        </p>
        <div className="flex flex-wrap gap-2">
          {PANELS.map((p) => {
            const slatDisabled = p.id === 'slat' && !mfjFiling
            const hasSandbox = sandboxSources.has(p.id ?? '')
            const hasConfirmed = confirmedSources.has(p.id ?? '')
            const hasAdvisorSandbox = advisorSandboxSources.has(p.id ?? '')
            return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (slatDisabled) return
                setActivePanel(activePanel === p.id ? null : p.id)
              }}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                activePanel === p.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }${slatDisabled ? ' opacity-40 cursor-default' : ''}`}
              title={slatDisabled ? 'Available for married couples only' : undefined}
            >
              {p.label}
              <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle">
                {hasConfirmed && (
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="In your plan" />
                )}
                {hasSandbox && !hasConfirmed && (
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" title="In sandbox" />
                )}
                {hasAdvisorSandbox && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border-2 border-blue-500 bg-white"
                    title="Advisor recommendation"
                  />
                )}
              </span>
            </button>
            )
          })}
        </div>
      </div>

      {/* ── GRAT ─────────────────────────────────────────────────────────── */}
      {activePanel === 'grat' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <StrategyEducationCard panelId="grat" ctx={ctx} filingStatus={filingStatus} userRole={userRole} />
          <h4 className="text-sm font-semibold text-gray-800">Model this strategy</h4>
          <AdvisorHintBanner advisorLineItems={advisorLineItems} strategySource="grat" />
          {estateContext && (
            <div className="text-xs text-[color:var(--mwm-navy)] bg-[var(--mwm-gold-pale)] border border-[color:var(--mwm-border)] rounded-lg px-3 py-2">
              Pre-populated from your estate: gross estate {fmt(grossEstate)}, funding at 25% = {fmt(Math.round(grossEstate * 0.25))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Funding Amount', key: 'fundingAmount', value: gratConfig.fundingAmount },
              { label: 'Term (years)', key: 'termYears', value: gratConfig.termYears },
              { label: 'Expected Growth Rate', key: 'expectedGrowthRate', value: gratConfig.expectedGrowthRate, step: 0.01 },
              { label: '§7520 Rate', key: 'section7520Rate', value: gratConfig.section7520Rate, step: 0.001 },
              { label: 'Death Year', key: 'deathYear', value: gratConfig.deathYear },
              { label: 'Rolling GRATs #', key: 'numberOfRollingGRATs', value: gratConfig.numberOfRollingGRATs },
            ].map(({ label, key, value, step }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" step={step ?? 1} value={value}
                  onChange={(e) => setGratConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isZeroedOut" checked={gratConfig.isZeroedOut}
                onChange={(e) => setGratConfig((c) => ({ ...c, isZeroedOut: e.target.checked }))} className="rounded" />
              <label htmlFor="isZeroedOut" className="text-sm text-gray-600">Zeroed-out GRAT</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isRolling" checked={gratConfig.isRollingStrategy}
                onChange={(e) => setGratConfig((c) => ({ ...c, isRollingStrategy: e.target.checked }))} className="rounded" />
              <label htmlFor="isRolling" className="text-sm text-gray-600">Rolling GRAT strategy</label>
            </div>
          </div>
          {gratResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Annual Annuity</span><span className="font-medium">{fmt(gratResult.annualAnnuityPayment)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Taxable Gift</span><span className="font-medium">{fmt(gratResult.taxableGift)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Projected Remainder</span><span className="font-medium text-green-700">{fmt(gratResult.projectedRemainder)}</span></div>
              {gratResult.rollingStrategyTotalRemainder !== undefined && (
                <div className="flex justify-between text-sm"><span className="text-gray-600">Rolling Strategy Remainder</span><span className="font-medium text-blue-700">{fmt(gratResult.rollingStrategyTotalRemainder)}</span></div>
              )}
              {gratResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton
            strategySource="grat" saved={saved} saving={saving} userRole={userRole}
            status={statuses['grat']} onCycleStatus={() => cycleStatus('grat')}
            onToggle={() => void handleModelToggle('grat', {
              scenario_id: 'current_law', metric_target: 'gross_estate', category: 'trust_exclusion',
              strategy_source: 'grat', amount: gratResult?.projectedRemainder ?? 0, sign: -1,
              confidence_level: 'illustrative',
              effective_year: new Date().getFullYear() + (gratConfig.termYears ?? 5),
              metadata: { funding_amount: gratConfig.fundingAmount, term_years: gratConfig.termYears, projected_remainder: gratResult?.projectedRemainder ?? 0 },
            })}
          />
        </div>
      )}

      {/* ── CRT ──────────────────────────────────────────────────────────── */}
      {activePanel === 'crt' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <StrategyEducationCard panelId="crt" ctx={ctx} filingStatus={filingStatus} userRole={userRole} />
          <h4 className="text-sm font-semibold text-gray-800">Model this strategy</h4>
          <AdvisorHintBanner advisorLineItems={advisorLineItems} strategySource="crt" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Funding Amount', key: 'fundingAmount', value: crtConfig.fundingAmount },
              { label: 'Payout Rate', key: 'payoutRate', value: crtConfig.payoutRate, step: 0.01 },
              { label: 'Term (years)', key: 'termYears', value: crtConfig.termYears },
              { label: '§7520 Rate', key: 'section7520Rate', value: crtConfig.section7520Rate, step: 0.001 },
              { label: 'Marginal Tax Rate', key: 'marginalIncomeTaxRate', value: crtConfig.marginalIncomeTaxRate, step: 0.01 },
              { label: 'Growth Rate', key: 'growthRate', value: crtConfig.growthRate, step: 0.01 },
            ].map(({ label, key, value, step }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" step={step ?? 1} value={value}
                  onChange={(e) => setCrtConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
          </div>
          {crtResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Annual Income</span><span className="font-medium">{fmt(crtResult.annualIncome)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Charitable Deduction</span><span className="font-medium">{fmt(crtResult.charitableDeduction)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Tax Savings</span><span className="font-medium text-green-700">{fmt(crtResult.taxSavingsFromDeduction)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Estate Reduction</span><span className="font-medium text-green-700">{fmt(crtResult.estateReduction)}</span></div>
              {crtResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton
            strategySource="crt" saved={saved} saving={saving} userRole={userRole}
            status={statuses['crt']} onCycleStatus={() => cycleStatus('crt')}
            onToggle={() => void handleModelToggle('crt', {
              scenario_id: 'current_law', metric_target: 'taxable_estate', category: 'charitable',
              strategy_source: 'crt', amount: crtResult?.estateReduction ?? crtConfig.fundingAmount,
              sign: -1, confidence_level: 'illustrative',
            })}
          />
        </div>
      )}

      {/* ── CLAT ─────────────────────────────────────────────────────────── */}
      {activePanel === 'clat' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <StrategyEducationCard panelId="clat" ctx={ctx} filingStatus={filingStatus} userRole={userRole} />
          <h4 className="text-sm font-semibold text-gray-800">Model this strategy</h4>
          <AdvisorHintBanner advisorLineItems={advisorLineItems} strategySource="clat" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Funding Amount', key: 'fundingAmount', value: clatConfig.fundingAmount },
              { label: 'Annual Charitable Annuity', key: 'annualCharitableAnnuity', value: clatConfig.annualCharitableAnnuity },
              { label: 'Term (years)', key: 'termYears', value: clatConfig.termYears },
              { label: '§7520 Rate', key: 'section7520Rate', value: clatConfig.section7520Rate, step: 0.001 },
              { label: 'Growth Rate', key: 'growthRate', value: clatConfig.growthRate, step: 0.01 },
            ].map(({ label, key, value, step }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" step={step ?? 1} value={value}
                  onChange={(e) => setClatConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="clatZeroed" checked={clatConfig.isZeroedOut}
                onChange={(e) => setClatConfig((c) => ({ ...c, isZeroedOut: e.target.checked }))} className="rounded" />
              <label htmlFor="clatZeroed" className="text-sm text-gray-600">Zeroed-out CLAT</label>
            </div>
          </div>
          {clatResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Taxable Gift</span><span className="font-medium">{fmt(clatResult.taxableGift)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Projected Remainder to Heirs</span><span className="font-medium text-green-700">{fmt(clatResult.projectedRemainder)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Charitable Giving</span><span className="font-medium">{fmt(clatResult.totalCharitableGiving)}</span></div>
              {clatResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs mt-2 ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton
            strategySource="clat" saved={saved} saving={saving} userRole={userRole}
            status={statuses['clat']} onCycleStatus={() => cycleStatus('clat')}
            onToggle={() => void handleModelToggle('clat', {
              scenario_id: 'current_law', metric_target: 'taxable_estate', category: 'charitable',
              strategy_source: 'clat', amount: clatResult?.projectedRemainder ?? clatConfig.fundingAmount,
              sign: -1, confidence_level: 'illustrative',
            })}
          />
        </div>
      )}

      {/* ── DAF ──────────────────────────────────────────────────────────── */}
      {activePanel === 'daf' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <StrategyEducationCard
            panelId="daf"
            ctx={ctx}
            filingStatus={filingStatus}
            defaultOpen={!charitableSaved}
            userRole={userRole}
          />
          <AdvisorHintBanner advisorLineItems={advisorLineItems} strategySource="daf" />
          <CharitableStrategyForm
            householdId={householdId}
            savedRow={charitableSaved}
            onSaved={refreshAfterStrategyWrite}
            onRemoved={refreshAfterStrategyWrite}
          />
        </div>
      )}

      {/* ── Liquidity ─────────────────────────────────────────────────────── */}
      {activePanel === 'liquidity' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <StrategyEducationCard panelId="liquidity" ctx={ctx} filingStatus={filingStatus} userRole={userRole} />
          <h4 className="text-sm font-semibold text-gray-800">Model this strategy</h4>
          <AdvisorHintBanner advisorLineItems={advisorLineItems} strategySource="liquidity" />
          {estateContext && (
            <div className="text-xs text-[color:var(--mwm-navy)] bg-[var(--mwm-gold-pale)] border border-[color:var(--mwm-border)] rounded-lg px-3 py-2">
              Pre-populated from your estate: {fmt(liquidAssets)} liquid, {fmt(illiquidAssets)} illiquid
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Liquid Assets', key: 'liquidAssets', value: liquidityConfig.liquidAssets },
              { label: 'Illiquid Assets', key: 'illiquidAssets', value: liquidityConfig.illiquidAssets },
              { label: 'Est. Federal Tax', key: 'estimatedFederalTax', value: liquidityConfig.estimatedFederalTax },
              { label: 'Est. State Tax', key: 'estimatedStateTax', value: liquidityConfig.estimatedStateTax },
              { label: 'ILIT Death Benefit', key: 'ilitDeathBenefit', value: liquidityConfig.ilitDeathBenefit },
              { label: 'Other Liquidity Sources', key: 'otherLiquiditySources', value: liquidityConfig.otherLiquiditySources },
            ].map(({ label, key, value }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" value={value}
                  onChange={(e) => setLiquidityConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
            <div className="flex items-center gap-2 col-span-2">
              <input type="checkbox" id="ilit2035" checked={liquidityConfig.ilitSection2035Flag}
                onChange={(e) => setLiquidityConfig((c) => ({ ...c, ilitSection2035Flag: e.target.checked }))} className="rounded" />
              <label htmlFor="ilit2035" className="text-sm text-gray-600">ILIT §2035 flag active</label>
            </div>
          </div>
          {liquidityResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Tax Burden</span><span className="font-medium">{fmt(liquidityResult.totalTaxBurden)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Liquidity</span><span className="font-medium">{fmt(liquidityResult.totalLiquidity)}</span></div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Coverage Ratio</span>
                <span className={`font-medium ${liquidityResult.coverageRatio >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                  {liquidityResult.coverageRatio === 999 ? 'No tax burden' : `${(liquidityResult.coverageRatio * 100).toFixed(0)}%`}
                </span>
              </div>
              {liquidityResult.hasLiquidityShortfall && (
                <div className="flex justify-between text-sm"><span className="text-gray-600">Shortfall</span><span className="font-medium text-red-600">{fmt(liquidityResult.shortfall)}</span></div>
              )}
              {liquidityResult.recommendedILITCoverage > 0 && (
                <div className="flex justify-between text-sm"><span className="text-gray-600">Recommended ILIT Coverage</span><span className="font-medium">{fmt(liquidityResult.recommendedILITCoverage)}</span></div>
              )}
              {liquidityResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton
            strategySource="liquidity" saved={saved} saving={saving} userRole={userRole}
            status={statuses.liquidity} onCycleStatus={() => cycleStatus('liquidity')}
            onToggle={() => void handleModelToggle('liquidity', {
              scenario_id: 'current_law', metric_target: 'gross_estate', category: 'liability',
              strategy_source: 'liquidity', amount: liquidityConfig.ilitDeathBenefit, sign: -1, confidence_level: 'illustrative',
            })}
          />
        </div>
      )}

      {/* ── Roth ─────────────────────────────────────────────────────────── */}
      {activePanel === 'roth' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <StrategyEducationCard panelId="roth" ctx={ctx} filingStatus={filingStatus} userRole={userRole} />
          <h4 className="text-sm font-semibold text-gray-800">Model this strategy</h4>
          <AdvisorHintBanner advisorLineItems={advisorLineItems} strategySource="roth" />
          {rothBalance > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-blue-800">Client actuals (from base case)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-blue-700">
                <span>Current Roth balance</span><span className="text-right font-medium">{fmt(rothBalance)}</span>
                <span>Pre-tax IRA balance</span><span className="text-right font-medium">{fmt(preIRABalance)}</span>
                <span>Annual RMD</span><span className="text-right font-medium">{fmt(annualRMD)}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Pre-Tax IRA Balance', key: 'preIRABalance', value: rothConfig.preIRABalance },
              { label: 'Annual RMD', key: 'annualRMD', value: rothConfig.annualRMD },
              { label: 'Annual Conversion Amount', key: 'annualConversionAmount', value: rothConfig.annualConversionAmount },
              { label: 'Conversion Years', key: 'conversionYears', value: rothConfig.conversionYears },
              { label: 'Marginal Rate (conversion)', key: 'marginalTaxRateDuringConversion', value: rothConfig.marginalTaxRateDuringConversion, step: 0.01 },
              { label: 'Beneficiary Marginal Rate', key: 'beneficiaryMarginalTaxRate', value: rothConfig.beneficiaryMarginalTaxRate, step: 0.01 },
              { label: 'Growth Rate', key: 'growthRate', value: rothConfig.growthRate, step: 0.01 },
              { label: 'Years Until Death', key: 'yearsUntilDeath', value: rothConfig.yearsUntilDeath },
            ].map(({ label, key, value, step }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type="number" step={step ?? 1} value={value}
                  onChange={(e) => setRothConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
              </div>
            ))}
          </div>
          {rothResult && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Converted</span><span className="font-medium">{fmt(rothConfig.annualConversionAmount * rothConfig.conversionYears)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Conversion Tax Cost</span><span className="font-medium">{fmt(rothResult.totalConversionTaxCost)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Projected Roth Balance at Death</span><span className="font-medium text-green-700">{fmt(rothResult.projectedRothBalanceAtDeath)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Estate Reduction from Tax Payment</span><span className="font-medium text-green-700">{fmt(rothResult.estateReductionFromTaxPayment)}</span></div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">NPV Benefit to Beneficiaries</span>
                <span className={`font-medium ${rothResult.npvBenefitToBeneficiaries >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(rothResult.npvBenefitToBeneficiaries)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Conversion NPV Positive?</span>
                <span className={`font-medium ${rothResult.conversionIsNPVPositive ? 'text-green-700' : 'text-amber-600'}`}>{rothResult.conversionIsNPVPositive ? 'Yes' : 'No'}</span>
              </div>
              {rothResult.advisoryNotes.map((note, i) => (
                <div key={i} className={`rounded p-3 text-xs ${note.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>{note}</div>
              ))}
            </div>
          )}
          <RecommendButton
            strategySource="roth" saved={saved} saving={saving} userRole={userRole}
            status={statuses.roth} onCycleStatus={() => cycleStatus('roth')}
            onToggle={() => void handleModelToggle('roth', {
              scenario_id: 'current_law', metric_target: 'taxable_estate', category: 'trust_exclusion',
              strategy_source: 'roth',
              amount: rothResult?.estateReductionFromTaxPayment ?? rothConfig.annualConversionAmount * rothConfig.conversionYears,
              sign: -1, confidence_level: 'illustrative',
            })}
          />
        </div>
      )}


      {activePanel === 'slat' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <StrategyEducationCard
            panelId="slat"
            ctx={ctx}
            filingStatus={filingStatus}
            defaultOpen={!slatSaved}
            userRole={userRole}
          />
          <AdvisorHintBanner advisorLineItems={advisorLineItems} strategySource="slat" />
          <SlatStrategyForm
            householdId={householdId}
            disabled={slatBlocked}
            disabledReason="SLAT is available for married couples filing jointly only."
            savedRow={slatSaved}
            onSaved={refreshAfterStrategyWrite}
            onRemoved={refreshAfterStrategyWrite}
          />
        </div>
      )}

      {activePanel === 'ilit' && ownerUserId && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <StrategyEducationCard
            panelId="ilit"
            ctx={ctx}
            filingStatus={filingStatus}
            defaultOpen={!ilitSaved}
            userRole={userRole}
          />
          <AdvisorHintBanner advisorLineItems={advisorLineItems} strategySource="ilit" />
          <IlitStrategyForm
            householdId={householdId}
            ownerUserId={ownerUserId}
            savedRow={ilitSaved}
            onSaved={refreshAfterStrategyWrite}
            onRemoved={refreshAfterStrategyWrite}
          />
        </div>
      )}

      {activePanel === 'ilit' && !ownerUserId && (
        <p className="text-sm text-gray-500">Sign in to model ILIT strategies.</p>
      )}

      <p className="text-xs text-gray-500">
        Estimates are educational and should be reviewed with your attorney, CPA, and advisor.
      </p>
    </div>
  )
}